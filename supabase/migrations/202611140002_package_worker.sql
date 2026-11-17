-- Development only. Requires the reviewed Map/Pro schema and the preceding
-- package migration. Do not apply to production until all clients and policies
-- are migrated and the complete flow has been tested.

CREATE TABLE public.package_visit_links (
  order_id integer PRIMARY KEY REFERENCES public.snow_orders(id),
  visit_id integer NOT NULL UNIQUE REFERENCES public.order_visits(id),
  request_id uuid NOT NULL UNIQUE,
  request_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.package_visit_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.package_visit_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.package_visit_links TO service_role;

CREATE TABLE public.package_invoice_requests (
  request_id uuid PRIMARY KEY,
  invoice_id bigint NOT NULL UNIQUE REFERENCES public.invoices(id),
  request_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.package_invoice_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.package_invoice_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.package_invoice_requests TO service_role;

CREATE FUNCTION public.worker_is_package_order(p_order_id integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.snow_orders WHERE id = p_order_id) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.package_credit_ledger WHERE order_id = p_order_id AND event_type = 'reserved');
END;
$$;
REVOKE ALL ON FUNCTION public.worker_is_package_order(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_is_package_order(integer) TO service_role;

CREATE FUNCTION public.guard_package_order_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF current_setting('role') IN ('anon', 'authenticated') AND EXISTS (
    SELECT 1 FROM public.package_credit_ledger WHERE order_id = OLD.id AND event_type = 'reserved'
  ) THEN
    RAISE EXCEPTION 'Package orders require an approved work device';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_package_order_changes
  BEFORE UPDATE OR DELETE ON public.snow_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_package_order_changes();

CREATE FUNCTION public.guard_package_visit_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE old_order integer; new_order integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_order := OLD.order_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_order := NEW.order_id; END IF;
  IF current_setting('role') IN ('anon', 'authenticated') AND EXISTS (
    SELECT 1 FROM public.package_credit_ledger
    WHERE order_id IN (old_order, new_order) AND event_type = 'reserved'
  ) THEN
    RAISE EXCEPTION 'Package visits require an approved work device';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_package_visit_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_visits
  FOR EACH ROW EXECUTE FUNCTION public.guard_package_visit_changes();

-- Direct invoice writes for an address with a paid package are blocked, even
-- if an older app does not know which visits were prepaid.
CREATE FUNCTION public.guard_package_invoice_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE old_profile integer; new_profile integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_profile := OLD.address_profile_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_profile := NEW.address_profile_id; END IF;
  IF current_setting('role') IN ('anon', 'authenticated') AND EXISTS (
    SELECT 1 FROM public.address_profiles a
    WHERE a.id IN (old_profile, new_profile) AND (
      EXISTS (SELECT 1 FROM public.package_purchases p
        WHERE p.payment_status = 'paid' AND lower(trim(p.service_address)) = lower(trim(a.address)))
      OR EXISTS (SELECT 1 FROM public.order_visits v JOIN public.package_credit_ledger l ON l.order_id = v.order_id
        WHERE v.address_profile_id = a.id AND l.event_type = 'reserved')
    )
  ) THEN
    RAISE EXCEPTION 'Package invoices require an approved work device';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_package_invoice_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_package_invoice_changes();

CREATE FUNCTION public.worker_save_package_order(
  p_order_id integer, p_expected_updated_at timestamptz, p_patch jsonb
)
RETURNS public.snow_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE item public.snow_orders%ROWTYPE; key text; new_status text;
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'Invalid order update'; END IF;
  FOR key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF key NOT IN ('status', 'name', 'phone', 'info', 'notes', 'lat', 'lon') OR
       (key IN ('lat', 'lon') AND jsonb_typeof(p_patch -> key) NOT IN ('number', 'null')) OR
       (key NOT IN ('lat', 'lon') AND jsonb_typeof(p_patch -> key) NOT IN ('string', 'null')) THEN
      RAISE EXCEPTION 'Invalid order update field';
    END IF;
  END LOOP;
  SELECT * INTO item FROM public.snow_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.worker_is_package_order(p_order_id) THEN RAISE EXCEPTION 'Package order not found'; END IF;
  IF item.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Order changed; refresh before saving'; END IF;
  IF item.status = 'peruttu' THEN RAISE EXCEPTION 'Order is cancelled'; END IF;
  new_status := CASE WHEN p_patch ? 'status' THEN p_patch ->> 'status' ELSE item.status END;
  IF new_status IS NULL OR new_status NOT IN ('odottaa', 'uusi', 'kesken', 'kuitattu') OR
     (item.status = 'kuitattu' AND new_status <> 'kuitattu') THEN
    RAISE EXCEPTION 'Invalid package order status';
  END IF;
  IF (p_patch ? 'name' AND (p_patch ->> 'name' IS NULL OR length(trim(p_patch ->> 'name')) NOT BETWEEN 1 AND 200)) OR
     (p_patch ? 'phone' AND (p_patch ->> 'phone' IS NULL OR length(trim(p_patch ->> 'phone')) NOT BETWEEN 1 AND 40)) OR
     length(COALESCE(p_patch ->> 'info', '')) > 2000 OR length(COALESCE(p_patch ->> 'notes', '')) > 2000 OR
     ((p_patch ? 'lat') <> (p_patch ? 'lon')) OR
     (p_patch ? 'lat' AND (
       ((p_patch ->> 'lat') IS NULL) <> ((p_patch ->> 'lon') IS NULL) OR
       (p_patch ->> 'lat')::numeric NOT BETWEEN -90 AND 90 OR (p_patch ->> 'lon')::numeric NOT BETWEEN -180 AND 180
     )) THEN
    RAISE EXCEPTION 'Invalid order details';
  END IF;
  UPDATE public.snow_orders SET
    status = new_status,
    name = CASE WHEN p_patch ? 'name' THEN trim(p_patch ->> 'name') ELSE name END,
    phone = CASE WHEN p_patch ? 'phone' THEN trim(p_patch ->> 'phone') ELSE phone END,
    info = CASE WHEN p_patch ? 'info' THEN p_patch ->> 'info' ELSE info END,
    notes = CASE WHEN p_patch ? 'notes' THEN p_patch ->> 'notes' ELSE notes END,
    lat = CASE WHEN p_patch ? 'lat' THEN (p_patch ->> 'lat')::double precision ELSE lat END,
    lon = CASE WHEN p_patch ? 'lon' THEN (p_patch ->> 'lon')::double precision ELSE lon END,
    updated_at = clock_timestamp()
  WHERE id = p_order_id RETURNING * INTO item;
  IF new_status = 'kuitattu' THEN PERFORM public.complete_package_order(p_order_id); END IF;
  RETURN item;
END;
$$;
REVOKE ALL ON FUNCTION public.worker_save_package_order(integer, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_save_package_order(integer, timestamptz, jsonb) TO service_role;

CREATE FUNCTION public.worker_add_package_visit(
  p_order_id integer, p_request_id uuid, p_visit_date date, p_snow_amount text, p_notes text
)
RETURNS public.order_visits LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  item public.snow_orders%ROWTYPE;
  link public.package_visit_links%ROWTYPE;
  visit public.order_visits%ROWTYPE;
  profile_id integer;
  payload jsonb;
BEGIN
  IF p_order_id IS NULL OR p_request_id IS NULL OR p_visit_date IS NULL OR
     p_snow_amount IS NULL OR p_snow_amount NOT IN ('pieni', 'iso') OR
     length(COALESCE(p_notes, '')) > 2000 THEN RAISE EXCEPTION 'Invalid visit details'; END IF;
  SELECT * INTO item FROM public.snow_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.worker_is_package_order(p_order_id) THEN RAISE EXCEPTION 'Package order not found'; END IF;
  payload := jsonb_build_object('order_id', p_order_id, 'date', p_visit_date, 'snow_amount', p_snow_amount, 'notes', NULLIF(trim(p_notes), ''));
  SELECT * INTO link FROM public.package_visit_links WHERE request_id = p_request_id;
  IF FOUND THEN
    IF link.request_payload <> payload THEN RAISE EXCEPTION 'Visit request conflict'; END IF;
    SELECT * INTO STRICT visit FROM public.order_visits WHERE id = link.visit_id;
    RETURN visit;
  END IF;
  IF item.status = 'peruttu' OR EXISTS (SELECT 1 FROM public.package_credit_ledger WHERE order_id = p_order_id AND event_type = 'restored') THEN
    RAISE EXCEPTION 'Package order is unavailable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_visits WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Existing visit requires review';
  END IF;
  INSERT INTO public.address_profiles (address, primary_phone)
    VALUES (item.address, item.phone)
    ON CONFLICT (address_normalized) DO UPDATE SET address = public.address_profiles.address
    RETURNING id INTO profile_id;
  INSERT INTO public.order_visits (order_id, address_profile_id, visit_date, snow_amount, notes)
    VALUES (p_order_id, profile_id, p_visit_date, p_snow_amount, NULLIF(trim(p_notes), ''))
    RETURNING * INTO visit;
  INSERT INTO public.package_visit_links (order_id, visit_id, request_id, request_payload)
    VALUES (p_order_id, visit.id, p_request_id, payload);
  IF item.status <> 'kuitattu' THEN
    UPDATE public.snow_orders SET status = 'kuitattu', updated_at = clock_timestamp() WHERE id = p_order_id;
  END IF;
  PERFORM public.complete_package_order(p_order_id);
  RETURN visit;
END;
$$;
REVOKE ALL ON FUNCTION public.worker_add_package_visit(integer, uuid, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_add_package_visit(integer, uuid, date, text, text) TO service_role;

CREATE FUNCTION public.worker_generate_invoice(
  p_request_id uuid, p_profile_id integer, p_period_start date, p_period_end date,
  p_days_until_due integer, p_tax_percent numeric
)
RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  profile public.address_profiles%ROWTYPE;
  invoice public.invoices%ROWTYPE;
  all_visits integer;
  unmatched integer;
  small_count integer;
  large_count integer;
  subtotal numeric(10,2);
  tax_amount numeric(10,2);
  lines jsonb := '[]'::jsonb;
  existing public.package_invoice_requests%ROWTYPE;
  payload jsonb;
BEGIN
  IF p_request_id IS NULL OR p_profile_id IS NULL OR p_period_start IS NULL OR p_period_end IS NULL OR
     p_period_end < p_period_start OR p_days_until_due IS NULL OR p_days_until_due NOT BETWEEN 0 AND 365 OR
     p_tax_percent IS NULL OR p_tax_percent NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid invoice details'; END IF;
  payload := jsonb_build_object('profile_id', p_profile_id, 'start', p_period_start, 'end', p_period_end,
    'days_until_due', p_days_until_due, 'tax_percent', p_tax_percent);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  SELECT * INTO existing FROM public.package_invoice_requests WHERE request_id = p_request_id;
  IF FOUND THEN
    IF existing.request_payload <> payload THEN RAISE EXCEPTION 'Invoice request conflict'; END IF;
    SELECT * INTO STRICT invoice FROM public.invoices WHERE id = existing.invoice_id;
    RETURN invoice;
  END IF;
  SELECT * INTO profile FROM public.address_profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Address profile not found'; END IF;

  -- Serialize against package visit creation before inspecting its link.
  PERFORM s.id FROM public.snow_orders s
    WHERE s.id IN (SELECT v.order_id FROM public.order_visits v
      WHERE v.address_profile_id = p_profile_id AND v.visit_date BETWEEN p_period_start AND p_period_end)
    ORDER BY s.id FOR UPDATE;
  SELECT * INTO profile FROM public.address_profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Address profile not found'; END IF;
  PERFORM v.id FROM public.order_visits v
    WHERE v.address_profile_id = p_profile_id AND v.visit_date BETWEEN p_period_start AND p_period_end
    ORDER BY v.id FOR UPDATE;

  SELECT count(*)::integer,
    count(*) FILTER (WHERE l.order_id IS NOT NULL AND pv.visit_id IS NULL)::integer,
    count(*) FILTER (WHERE l.order_id IS NULL AND NOT COALESCE(s.is_free_order, false) AND v.snow_amount = 'pieni')::integer,
    count(*) FILTER (WHERE l.order_id IS NULL AND NOT COALESCE(s.is_free_order, false) AND v.snow_amount = 'iso')::integer
  INTO all_visits, unmatched, small_count, large_count
  FROM public.order_visits v
  JOIN public.snow_orders s ON s.id = v.order_id
  LEFT JOIN public.package_credit_ledger l ON l.order_id = v.order_id AND l.event_type = 'reserved'
  LEFT JOIN public.package_visit_links pv ON pv.visit_id = v.id AND pv.order_id = v.order_id
  WHERE v.address_profile_id = p_profile_id AND v.visit_date BETWEEN p_period_start AND p_period_end;
  IF unmatched > 0 THEN RAISE EXCEPTION 'Package visit needs manual review'; END IF;
  IF all_visits > 0 AND small_count + large_count = 0 THEN RAISE EXCEPTION 'No billable visits in period'; END IF;

  IF small_count > 0 THEN
    lines := lines || jsonb_build_array(jsonb_build_object(
      'description', format('Lumityö - Pienet käynnit (%s x)', small_count),
      'quantity', small_count, 'unit_price', 15, 'amount', small_count * 15));
  END IF;
  IF large_count > 0 THEN
    lines := lines || jsonb_build_array(jsonb_build_object(
      'description', format('Lumityö - Suuret käynnit (%s x)', large_count),
      'quantity', large_count, 'unit_price', 35, 'amount', large_count * 35));
  END IF;
  IF all_visits = 0 THEN
    lines := jsonb_build_array(jsonb_build_object('description', 'Ei käyntejä kaudella', 'quantity', 0, 'unit_price', 0, 'amount', 0));
  END IF;
  subtotal := small_count * 15 + large_count * 35;
  tax_amount := round(subtotal * p_tax_percent / 100, 2);
  INSERT INTO public.invoices (
    address_profile_id, invoice_date, due_date, period_start, period_end,
    line_items, subtotal, tax_percent, tax_amount, total_amount, status,
    customer_name, customer_email, customer_phone
  ) VALUES (
    p_profile_id, current_date, current_date + p_days_until_due, p_period_start, p_period_end,
    lines, subtotal, p_tax_percent, tax_amount, subtotal + tax_amount, 'draft',
    COALESCE(profile.address, 'Asiakas'), COALESCE(profile.primary_email, ''), COALESCE(profile.primary_phone, '')
  ) RETURNING * INTO invoice;
  INSERT INTO public.package_invoice_requests (request_id, invoice_id, request_payload)
    VALUES (p_request_id, invoice.id, payload);
  RETURN invoice;
END;
$$;
REVOKE ALL ON FUNCTION public.worker_generate_invoice(uuid, integer, date, date, integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_generate_invoice(uuid, integer, date, date, integer, numeric) TO service_role;

CREATE FUNCTION public.worker_update_invoice_status(p_invoice_id bigint, p_status text, p_payment_method text)
RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE invoice public.invoices%ROWTYPE;
BEGIN
  IF p_invoice_id IS NULL OR p_status IS NULL OR p_status NOT IN ('sent', 'paid', 'overdue', 'cancelled') OR
     length(COALESCE(p_payment_method, '')) > 100 THEN RAISE EXCEPTION 'Invalid invoice status'; END IF;
  UPDATE public.invoices SET
    status = p_status,
    payment_date = CASE WHEN p_status = 'paid' THEN current_date ELSE payment_date END,
    payment_method = CASE WHEN p_status = 'paid' AND p_payment_method IS NOT NULL THEN p_payment_method ELSE payment_method END
  WHERE id = p_invoice_id RETURNING * INTO invoice;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  RETURN invoice;
END;
$$;
REVOKE ALL ON FUNCTION public.worker_update_invoice_status(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_update_invoice_status(bigint, text, text) TO service_role;
