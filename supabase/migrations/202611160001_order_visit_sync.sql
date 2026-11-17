-- snow_orders is the single source of truth: one completed order is one visit.
-- All added data fields are nullable so older Tilaus and Map clients remain compatible.
ALTER TABLE public.snow_orders
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS visit_date date,
  ADD COLUMN IF NOT EXISTS snow_amount text,
  ADD COLUMN IF NOT EXISTS visit_notes text,
  ADD COLUMN IF NOT EXISTS address_profile_id integer REFERENCES public.address_profiles(id),
  ADD COLUMN IF NOT EXISTS recurring_source_order_id integer REFERENCES public.snow_orders(id),
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS hidden_from_map boolean DEFAULT false;

ALTER TABLE public.address_profiles ADD COLUMN IF NOT EXISTS name text;
CREATE INDEX IF NOT EXISTS snow_orders_address_profile_visit_idx
  ON public.snow_orders(address_profile_id, visit_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS snow_orders_one_recurring_successor_per_source
  ON public.snow_orders(recurring_source_order_id) WHERE recurring_source_order_id IS NOT NULL;

-- Keep a profile linked to every order, including inserts from older apps.
CREATE OR REPLACE FUNCTION public.attach_snow_order_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.address IS NULL OR btrim(NEW.address) = '' THEN RETURN NEW; END IF;
  INSERT INTO public.address_profiles(address, name, lat, lon, primary_phone, primary_email)
  VALUES (btrim(NEW.address), NEW.name, NEW.lat, NEW.lon, NEW.phone, NEW.email)
  ON CONFLICT (address_normalized) DO UPDATE SET
    name = COALESCE(public.address_profiles.name, EXCLUDED.name),
    lat = COALESCE(public.address_profiles.lat, EXCLUDED.lat),
    lon = COALESCE(public.address_profiles.lon, EXCLUDED.lon),
    primary_phone = COALESCE(public.address_profiles.primary_phone, EXCLUDED.primary_phone),
    primary_email = COALESCE(public.address_profiles.primary_email, EXCLUDED.primary_email)
  RETURNING id INTO NEW.address_profile_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS attach_snow_order_profile ON public.snow_orders;
CREATE TRIGGER attach_snow_order_profile BEFORE INSERT OR UPDATE OF address ON public.snow_orders
FOR EACH ROW EXECUTE FUNCTION public.attach_snow_order_profile();

-- Completion time is only stamped for new completions. Legacy timestamps are left unknown.
CREATE OR REPLACE FUNCTION public.stamp_snow_order_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status IN ('kuitattu', 'valmis') AND
     (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.completed_at := COALESCE(NEW.completed_at, clock_timestamp());
    NEW.visit_date := COALESCE(NEW.visit_date, (clock_timestamp() AT TIME ZONE 'Europe/Helsinki')::date);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IN ('kuitattu', 'valmis') AND NEW.status NOT IN ('kuitattu', 'valmis') THEN
    NEW.completed_at := NULL;
    NEW.visit_date := NULL;
    NEW.snow_amount := NULL;
    NEW.visit_notes := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS stamp_snow_order_completion ON public.snow_orders;
CREATE TRIGGER stamp_snow_order_completion BEFORE INSERT OR UPDATE OF status ON public.snow_orders
FOR EACH ROW EXECUTE FUNCTION public.stamp_snow_order_completion();

-- Create at most one active successor. The advisory lock serializes concurrent
-- completions for the same recurring customer/address (including both apps).
CREATE OR REPLACE FUNCTION public.create_recurring_snow_order_successor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE identity_key text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('kuitattu', 'valmis') AND NEW.status NOT IN ('kuitattu', 'valmis') THEN
    -- Roll back only the successor created for this exact completion. Keep a
    -- cancelled hidden row for auditability; a later re-completion gets a new one.
    UPDATE public.snow_orders SET status = 'peruttu', hidden_from_map = true, updated_at = clock_timestamp()
    WHERE recurring_source_order_id = NEW.id AND status IN ('odottaa', 'uusi', 'kesken');
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('kuitattu', 'valmis') OR NEW.jatkuva_tilaus IS DISTINCT FROM true OR
     (TG_OP = 'UPDATE' AND OLD.status IN ('kuitattu', 'valmis')) THEN RETURN NEW; END IF;
  -- Match Map app's recurringKey precedence: device ID, then phone, email,
  -- and finally customer name, combined with the normalized address.
  identity_key := COALESCE(
    NULLIF(btrim(NEW.device_id), ''),
    NULLIF(btrim(NEW.phone), ''),
    NULLIF(btrim(NEW.email), ''),
    'name:' || lower(btrim(COALESCE(NEW.name, '')))
  ) || '|' || lower(btrim(NEW.address));
  PERFORM pg_advisory_xact_lock(hashtextextended(identity_key, 0));
  IF NOT EXISTS (
    SELECT 1 FROM public.snow_orders s
    WHERE s.id <> NEW.id AND s.jatkuva_tilaus IS TRUE
      AND s.status IN ('odottaa', 'uusi', 'kesken')
      AND lower(btrim(s.address)) = lower(btrim(NEW.address))
      AND COALESCE(
        NULLIF(btrim(s.device_id), ''),
        NULLIF(btrim(s.phone), ''),
        NULLIF(btrim(s.email), ''),
        'name:' || lower(btrim(COALESCE(s.name, '')))
      ) = COALESCE(
        NULLIF(btrim(NEW.device_id), ''),
        NULLIF(btrim(NEW.phone), ''),
        NULLIF(btrim(NEW.email), ''),
        'name:' || lower(btrim(COALESCE(NEW.name, '')))
      )
  ) THEN
    INSERT INTO public.snow_orders
      (palvelu,address,phone,name,email,price,lat,lon,jatkuva_tilaus,status,info,device_id,is_free_order,hidden_from_map,address_profile_id,recurring_source_order_id)
    VALUES
      (NEW.palvelu,NEW.address,NEW.phone,NEW.name,NEW.email,NEW.price,NEW.lat,NEW.lon,true,'odottaa',
       COALESCE(NEW.info, 'Jatkuva tilaus'),NEW.device_id,NEW.is_free_order,true,NEW.address_profile_id,NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS create_recurring_snow_order_successor ON public.snow_orders;
CREATE TRIGGER create_recurring_snow_order_successor AFTER INSERT OR UPDATE OF status ON public.snow_orders
FOR EACH ROW EXECUTE FUNCTION public.create_recurring_snow_order_successor();

-- Profile counters now derive only from completed snow_orders. Missing historic
-- dates and snow amounts remain NULL instead of being guessed from updated_at.
CREATE OR REPLACE FUNCTION public.update_address_profile_stats(profile_id integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  UPDATE public.address_profiles ap SET
    total_visits = (SELECT count(*) FROM public.snow_orders so WHERE so.address_profile_id = profile_id AND so.status IN ('kuitattu','valmis')),
    small_visits = (SELECT count(*) FROM public.snow_orders so WHERE so.address_profile_id = profile_id AND so.status IN ('kuitattu','valmis') AND so.snow_amount = 'pieni'),
    large_visits = (SELECT count(*) FROM public.snow_orders so WHERE so.address_profile_id = profile_id AND so.status IN ('kuitattu','valmis') AND so.snow_amount = 'iso'),
    last_visit_date = (SELECT max(so.visit_date) FROM public.snow_orders so WHERE so.address_profile_id = profile_id AND so.status IN ('kuitattu','valmis')),
    updated_at = clock_timestamp()
  WHERE ap.id = profile_id;
$$;
CREATE OR REPLACE FUNCTION public.sync_snow_order_profile_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.address_profile_id IS NOT NULL THEN PERFORM public.update_address_profile_stats(OLD.address_profile_id); END IF;
  IF TG_OP <> 'DELETE' AND NEW.address_profile_id IS NOT NULL THEN PERFORM public.update_address_profile_stats(NEW.address_profile_id); END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_snow_order_profile_stats ON public.snow_orders;
CREATE TRIGGER sync_snow_order_profile_stats AFTER INSERT OR UPDATE OR DELETE ON public.snow_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_snow_order_profile_stats();

-- Backfill profile links only. Do not invent historic completion dates/amounts.
INSERT INTO public.address_profiles(address, name, lat, lon, primary_phone, primary_email)
SELECT DISTINCT ON (lower(btrim(address))) btrim(address), name, lat, lon, phone, email
FROM public.snow_orders WHERE address IS NOT NULL AND btrim(address) <> ''
ORDER BY lower(btrim(address)), created_at ASC
ON CONFLICT (address_normalized) DO NOTHING;
UPDATE public.snow_orders so SET address_profile_id = ap.id
FROM public.address_profiles ap WHERE so.address_profile_id IS NULL
  AND ap.address_normalized = lower(btrim(so.address));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT id FROM public.address_profiles LOOP
  PERFORM public.update_address_profile_stats(p.id);
END LOOP; END $$;

-- Keep the profile merge RPC compatible with the new canonical visit source.
CREATE OR REPLACE FUNCTION public.merge_address_profiles(
  p_keep_id INTEGER,
  p_merge_ids INTEGER[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keep_profile address_profiles%ROWTYPE;
  merge_profile address_profiles%ROWTYPE;
  merge_id INTEGER;
  keep_key TEXT;
  merge_key TEXT;
BEGIN
  IF p_merge_ids IS NULL OR cardinality(p_merge_ids) = 0 THEN
    RAISE EXCEPTION 'At least one profile must be selected to merge';
  END IF;

  SELECT * INTO keep_profile
  FROM address_profiles
  WHERE id = p_keep_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile to keep was not found';
  END IF;

  keep_key := regexp_replace(lower(translate(keep_profile.address, 'åäö', 'aao')), '[^a-z0-9]', '', 'g');
  IF keep_key = '' THEN
    RAISE EXCEPTION 'Address is empty';
  END IF;

  FOREACH merge_id IN ARRAY p_merge_ids LOOP
    IF merge_id = p_keep_id THEN
      RAISE EXCEPTION 'Cannot merge a profile into itself';
    END IF;

    SELECT * INTO merge_profile
    FROM address_profiles
    WHERE id = merge_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profile to merge was not found';
    END IF;

    -- Keep apartment and house numbers in the key so distinct units are not
    -- accidentally combined. Ignore case, spaces, and punctuation only.
    merge_key := regexp_replace(lower(translate(merge_profile.address, 'åäö', 'aao')), '[^a-z0-9]', '', 'g');
    IF keep_key <> merge_key THEN
      RAISE EXCEPTION 'Profiles do not have matching normalized addresses';
    END IF;

    UPDATE snow_orders
    SET address_profile_id = p_keep_id
    WHERE address_profile_id = merge_id;

    IF to_regclass('public.invoices') IS NOT NULL THEN
      EXECUTE 'UPDATE public.invoices SET address_profile_id = $1 WHERE address_profile_id = $2'
      USING p_keep_id, merge_id;
    END IF;

    -- Orders refer to profiles by address text, so normalize their address to
    -- the retained profile before removing the duplicate.
    UPDATE snow_orders
    SET address = keep_profile.address
    WHERE regexp_replace(lower(translate(address, 'åäö', 'aao')), '[^a-z0-9]', '', 'g') = merge_key;

    UPDATE address_profiles
    SET name = COALESCE(NULLIF(name, ''), NULLIF(merge_profile.name, '')),
        primary_phone = COALESCE(NULLIF(primary_phone, ''), NULLIF(merge_profile.primary_phone, '')),
        primary_email = COALESCE(NULLIF(primary_email, ''), NULLIF(merge_profile.primary_email, '')),
        lat = COALESCE(lat, merge_profile.lat),
        lon = COALESCE(lon, merge_profile.lon)
    WHERE id = p_keep_id;

    DELETE FROM address_profiles WHERE id = merge_id;
  END LOOP;

  PERFORM public.update_address_profile_stats(p_keep_id);
  RETURN p_keep_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_address_profiles(INTEGER, INTEGER[]) TO anon, authenticated;

-- Package visits now update their snow_order. Keep request idempotency keyed by
-- order_id/request_id, then remove the obsolete visit foreign key and table.
ALTER TABLE public.package_visit_links DROP COLUMN IF EXISTS visit_id;
DROP FUNCTION IF EXISTS public.worker_add_package_visit(integer, uuid, date, text, text);
CREATE FUNCTION public.worker_add_package_visit(
  p_order_id integer, p_request_id uuid, p_visit_date date, p_snow_amount text, p_notes text
) RETURNS public.snow_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE item public.snow_orders%ROWTYPE; link public.package_visit_links%ROWTYPE; payload jsonb;
BEGIN
  IF p_order_id IS NULL OR p_request_id IS NULL OR p_visit_date IS NULL OR p_snow_amount NOT IN ('pieni','iso') OR length(COALESCE(p_notes,'')) > 2000 THEN RAISE EXCEPTION 'Invalid visit details'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  SELECT * INTO item FROM public.snow_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.worker_is_package_order(p_order_id) THEN RAISE EXCEPTION 'Package order not found'; END IF;
  payload := jsonb_build_object('order_id',p_order_id,'date',p_visit_date,'snow_amount',p_snow_amount,'notes',NULLIF(btrim(p_notes),''));
  SELECT * INTO link FROM public.package_visit_links WHERE request_id=p_request_id;
  IF FOUND THEN
    IF link.request_payload <> payload THEN RAISE EXCEPTION 'Visit request conflict'; END IF;
    RETURN item;
  END IF;
  IF item.status='peruttu' OR EXISTS (SELECT 1 FROM public.package_credit_ledger WHERE order_id=p_order_id AND event_type='restored') THEN RAISE EXCEPTION 'Package order is unavailable'; END IF;
  IF item.status IN ('kuitattu','valmis') THEN RAISE EXCEPTION 'Existing completion requires review'; END IF;
  UPDATE public.snow_orders SET status='kuitattu', visit_date=p_visit_date, snow_amount=p_snow_amount,
    visit_notes=NULLIF(btrim(p_notes),''), completed_at=clock_timestamp(), updated_at=clock_timestamp()
  WHERE id=p_order_id RETURNING * INTO item;
  INSERT INTO public.package_visit_links(order_id,request_id,request_payload) VALUES(p_order_id,p_request_id,payload);
  PERFORM public.complete_package_order(p_order_id);
  RETURN item;
END $$;
REVOKE ALL ON FUNCTION public.worker_add_package_visit(integer, uuid, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_add_package_visit(integer, uuid, date, text, text) TO service_role;

-- Billing reads completed orders, and rejects unclassified visits rather than
-- silently excluding them. Package visits remain non-billable via their ledger.
CREATE OR REPLACE FUNCTION public.guard_package_invoice_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE old_profile integer; new_profile integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_profile := OLD.address_profile_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_profile := NEW.address_profile_id; END IF;
  IF current_setting('role') IN ('anon','authenticated') AND EXISTS (
    SELECT 1 FROM public.address_profiles a WHERE a.id IN (old_profile,new_profile) AND (
      EXISTS (SELECT 1 FROM public.package_purchases p WHERE p.payment_status='paid' AND lower(trim(p.service_address))=lower(trim(a.address)) ) OR
      EXISTS (SELECT 1 FROM public.snow_orders s JOIN public.package_credit_ledger l ON l.order_id=s.id WHERE s.address_profile_id=a.id AND l.event_type='reserved')
    )
  ) THEN RAISE EXCEPTION 'Package invoices require an approved work device'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.worker_generate_invoice(
  p_request_id uuid, p_profile_id integer, p_period_start date, p_period_end date,
  p_days_until_due integer, p_tax_percent numeric
) RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE profile public.address_profiles%ROWTYPE; invoice public.invoices%ROWTYPE;
  all_count integer; unmatched integer; small_count integer; large_count integer; subtotal numeric(10,2); tax_amount numeric(10,2);
  lines jsonb := '[]'::jsonb; existing public.package_invoice_requests%ROWTYPE; payload jsonb;
BEGIN
  IF p_request_id IS NULL OR p_profile_id IS NULL OR p_period_start IS NULL OR p_period_end<p_period_start OR p_days_until_due NOT BETWEEN 0 AND 365 OR p_tax_percent NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid invoice details'; END IF;
  payload:=jsonb_build_object('profile_id',p_profile_id,'start',p_period_start,'end',p_period_end,'days_until_due',p_days_until_due,'tax_percent',p_tax_percent);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  SELECT * INTO existing FROM public.package_invoice_requests WHERE request_id=p_request_id;
  IF FOUND THEN IF existing.request_payload<>payload THEN RAISE EXCEPTION 'Invoice request conflict'; END IF; SELECT * INTO STRICT invoice FROM public.invoices WHERE id=existing.invoice_id; RETURN invoice; END IF;
  SELECT * INTO profile FROM public.address_profiles WHERE id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Address profile not found'; END IF;
  PERFORM id FROM public.snow_orders WHERE address_profile_id=p_profile_id AND status IN ('kuitattu','valmis') AND visit_date BETWEEN p_period_start AND p_period_end ORDER BY id FOR UPDATE;
  SELECT count(*)::int,
    count(*) FILTER (WHERE l.order_id IS NOT NULL AND pv.order_id IS NULL)::int,
    count(*) FILTER (WHERE l.order_id IS NULL AND NOT COALESCE(s.is_free_order,false) AND s.snow_amount='pieni')::int,
    count(*) FILTER (WHERE l.order_id IS NULL AND NOT COALESCE(s.is_free_order,false) AND s.snow_amount='iso')::int
  INTO all_count,unmatched,small_count,large_count
  FROM public.snow_orders s LEFT JOIN public.package_credit_ledger l ON l.order_id=s.id AND l.event_type='reserved'
  LEFT JOIN public.package_visit_links pv ON pv.order_id=s.id
  WHERE s.address_profile_id=p_profile_id AND s.status IN ('kuitattu','valmis') AND s.visit_date BETWEEN p_period_start AND p_period_end;
  IF unmatched>0 THEN RAISE EXCEPTION 'Package visit needs manual review'; END IF;
  IF EXISTS (SELECT 1 FROM public.snow_orders s WHERE s.address_profile_id=p_profile_id AND s.status IN ('kuitattu','valmis') AND s.visit_date BETWEEN p_period_start AND p_period_end AND NOT COALESCE(s.is_free_order,false) AND s.snow_amount IS NULL AND NOT EXISTS (SELECT 1 FROM public.package_credit_ledger l WHERE l.order_id=s.id AND l.event_type='reserved')) THEN RAISE EXCEPTION 'Visit snow amount requires review'; END IF;
  IF all_count>0 AND small_count+large_count=0 THEN RAISE EXCEPTION 'No billable visits in period'; END IF;
  IF small_count>0 THEN lines:=lines||jsonb_build_array(jsonb_build_object('description',format('Lumityö - Pienet käynnit (%s x)',small_count),'quantity',small_count,'unit_price',15,'amount',small_count*15)); END IF;
  IF large_count>0 THEN lines:=lines||jsonb_build_array(jsonb_build_object('description',format('Lumityö - Suuret käynnit (%s x)',large_count),'quantity',large_count,'unit_price',35,'amount',large_count*35)); END IF;
  IF all_count=0 THEN lines:=jsonb_build_array(jsonb_build_object('description','Ei käyntejä kaudella','quantity',0,'unit_price',0,'amount',0)); END IF;
  subtotal:=small_count*15+large_count*35; tax_amount:=round(subtotal*p_tax_percent/100,2);
  INSERT INTO public.invoices(address_profile_id,invoice_date,due_date,period_start,period_end,line_items,subtotal,tax_percent,tax_amount,total_amount,status,customer_name,customer_email,customer_phone)
  VALUES(p_profile_id,current_date,current_date+p_days_until_due,p_period_start,p_period_end,lines,subtotal,p_tax_percent,tax_amount,subtotal+tax_amount,'draft',COALESCE(profile.address,'Asiakas'),COALESCE(profile.primary_email,''),COALESCE(profile.primary_phone,'')) RETURNING * INTO invoice;
  INSERT INTO public.package_invoice_requests(request_id,invoice_id,request_payload) VALUES(p_request_id,invoice.id,payload); RETURN invoice;
END $$;
REVOKE ALL ON FUNCTION public.worker_generate_invoice(uuid, integer, date, date, integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_generate_invoice(uuid, integer, date, date, integer, numeric) TO service_role;

DROP TRIGGER IF EXISTS guard_package_visit_changes ON public.order_visits;
DROP FUNCTION IF EXISTS public.guard_package_visit_changes();
DROP FUNCTION IF EXISTS public.sync_address_profile_stats_trigger();
DROP TABLE public.order_visits;
