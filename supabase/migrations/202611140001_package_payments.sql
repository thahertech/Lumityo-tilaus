-- Development migration. Do not apply to production until the complete
-- purchase, worker, billing, privacy and recovery flows have been verified.

CREATE TABLE public.package_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id),
  customer_email text NOT NULL CHECK (length(trim(customer_email)) > 0),
  service_address text NOT NULL CHECK (length(trim(service_address)) > 0),
  device_id text NOT NULL CHECK (length(trim(device_id)) BETWEEN 1 AND 200),
  phone text NOT NULL CHECK (length(trim(phone)) BETWEEN 1 AND 40),
  amount_cents integer NOT NULL DEFAULT 15000 CHECK (amount_cents = 15000),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  paytrail_stamp text NOT NULL UNIQUE,
  paytrail_transaction_id uuid UNIQUE,
  checkout_started_at timestamptz,
  checkout_url text,
  terms_version text NOT NULL CHECK (length(trim(terms_version)) > 0),
  terms_accepted_at timestamptz NOT NULL,
  payment_status text NOT NULL DEFAULT 'new'
    CHECK (payment_status IN ('new', 'pending', 'delayed', 'fail', 'paid', 'closed')),
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (payment_status = 'paid' AND paid_at IS NOT NULL AND expires_at IS NOT NULL AND paytrail_transaction_id IS NOT NULL)
    OR
    (payment_status <> 'paid' AND paid_at IS NULL AND expires_at IS NULL)
  )
);

-- A failed or uncertain checkout remains open for reconciliation; another
-- device must not start a second payment for the same customer.
CREATE UNIQUE INDEX package_one_unresolved_checkout_per_customer
  ON public.package_purchases (customer_id)
  WHERE payment_status NOT IN ('paid', 'closed');

CREATE TABLE public.package_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.package_purchases(id),
  event_type text NOT NULL CHECK (event_type IN ('issued', 'reserved', 'completed', 'restored')),
  delta integer NOT NULL,
  order_id integer REFERENCES public.snow_orders(id),
  request_id uuid,
  request_payload jsonb,
  remaining_after integer CHECK (remaining_after BETWEEN 0 AND 9),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (event_type = 'issued' AND delta = 10 AND order_id IS NULL AND request_id IS NULL AND request_payload IS NULL AND remaining_after IS NULL AND reason IS NULL)
    OR (event_type = 'reserved' AND delta = -1 AND order_id IS NOT NULL AND request_id IS NOT NULL AND request_payload IS NOT NULL AND remaining_after IS NOT NULL AND reason IS NULL)
    OR (event_type = 'completed' AND delta = 0 AND order_id IS NOT NULL AND request_id IS NULL AND request_payload IS NULL AND remaining_after IS NULL AND reason IS NULL)
    OR (event_type = 'restored' AND delta = 1 AND order_id IS NOT NULL AND request_id IS NULL AND request_payload IS NULL AND remaining_after IS NULL AND reason IS NOT NULL AND length(trim(reason)) BETWEEN 1 AND 1000)
  )
);

CREATE UNIQUE INDEX package_one_issuance
  ON public.package_credit_ledger (purchase_id) WHERE event_type = 'issued';
CREATE UNIQUE INDEX package_one_reservation_per_order
  ON public.package_credit_ledger (order_id) WHERE event_type = 'reserved';
CREATE UNIQUE INDEX package_one_completion_per_order
  ON public.package_credit_ledger (order_id) WHERE event_type = 'completed';
CREATE UNIQUE INDEX package_one_restoration_per_order
  ON public.package_credit_ledger (order_id) WHERE event_type = 'restored';
CREATE UNIQUE INDEX package_unique_order_request
  ON public.package_credit_ledger (request_id) WHERE request_id IS NOT NULL;

CREATE TABLE public.package_receipt_outbox (
  purchase_id uuid PRIMARY KEY REFERENCES public.package_purchases(id),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'needs_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  attempted_at timestamptz,
  sent_at timestamptz,
  error_code text,
  CHECK (
    (state = 'pending' AND attempted_at IS NULL AND sent_at IS NULL AND error_code IS NULL)
    OR (state = 'sending' AND attempted_at IS NOT NULL AND sent_at IS NULL AND error_code IS NULL)
    OR (state = 'sent' AND attempted_at IS NOT NULL AND sent_at IS NOT NULL AND error_code IS NULL)
    OR (state = 'needs_review' AND attempted_at IS NOT NULL AND sent_at IS NULL AND error_code IS NOT NULL)
  )
);

ALTER TABLE public.package_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_receipt_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.package_purchases, public.package_credit_ledger, public.package_receipt_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.package_purchases TO service_role;
GRANT SELECT, INSERT ON public.package_credit_ledger TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.package_receipt_outbox TO service_role;

-- Only a trusted server may invoke this after validating the Paytrail response
-- and obtaining the confirmed transaction's actual paid timestamp.
CREATE FUNCTION public.confirm_package_payment(
  p_purchase_id uuid,
  p_transaction_id uuid,
  p_paid_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  purchase public.package_purchases%ROWTYPE;
BEGIN
  IF p_purchase_id IS NULL OR p_transaction_id IS NULL OR p_paid_at IS NULL OR p_paid_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Invalid confirmed payment details';
  END IF;

  SELECT * INTO purchase FROM public.package_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package purchase not found'; END IF;
  IF purchase.paytrail_transaction_id IS DISTINCT FROM p_transaction_id THEN
    RAISE EXCEPTION 'Paytrail transaction mismatch';
  END IF;
  IF p_paid_at < purchase.created_at - interval '5 minutes' THEN
    RAISE EXCEPTION 'Payment predates purchase';
  END IF;
  IF purchase.payment_status = 'paid' THEN
    RETURN;
  END IF;

  UPDATE public.package_purchases
  SET payment_status = 'paid', paid_at = p_paid_at, expires_at = p_paid_at + interval '24 months'
  WHERE id = p_purchase_id;
  INSERT INTO public.package_credit_ledger (purchase_id, event_type, delta)
    VALUES (p_purchase_id, 'issued', 10);
  INSERT INTO public.package_receipt_outbox (purchase_id) VALUES (p_purchase_id);
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_package_payment(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_package_payment(uuid, uuid, timestamptz) TO service_role;

CREATE FUNCTION public.my_snow_packages()
RETURNS TABLE (
  id uuid,
  service_address text,
  paid_at timestamptz,
  expires_at timestamptz,
  remaining integer,
  reserved integer,
  completed integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.id, p.service_address, p.paid_at, p.expires_at, COALESCE(sum(l.delta), 0)::integer,
    count(*) FILTER (WHERE l.event_type = 'reserved' AND NOT EXISTS (
      SELECT 1 FROM public.package_credit_ledger terminal
      WHERE terminal.order_id = l.order_id AND terminal.event_type IN ('completed', 'restored')
    ))::integer,
    count(*) FILTER (WHERE l.event_type = 'completed' AND NOT EXISTS (
      SELECT 1 FROM public.package_credit_ledger restoration
      WHERE restoration.order_id = l.order_id AND restoration.event_type = 'restored'
    ))::integer
  FROM public.package_purchases p
  LEFT JOIN public.package_credit_ledger l ON l.purchase_id = p.id
  WHERE p.customer_id = auth.uid() AND p.payment_status = 'paid'
  GROUP BY p.id
  ORDER BY p.expires_at, p.created_at;
$$;
REVOKE ALL ON FUNCTION public.my_snow_packages() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_snow_packages() TO authenticated;

CREATE FUNCTION public.my_unresolved_package_checkout()
RETURNS TABLE (id uuid, customer_email text, service_address text, device_id text, phone text, terms_version text, payment_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.id, p.customer_email, p.service_address, p.device_id, p.phone, p.terms_version, p.payment_status
  FROM public.package_purchases p
  WHERE p.customer_id = auth.uid() AND p.payment_status NOT IN ('paid', 'closed');
$$;
REVOKE ALL ON FUNCTION public.my_unresolved_package_checkout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_unresolved_package_checkout() TO authenticated;

CREATE FUNCTION public.my_package_orders()
RETURNS TABLE (order_id integer, service_address text, status text, created_at timestamptz, remaining_after integer, restored boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT o.id, p.service_address, o.status, o.created_at, l.remaining_after,
    EXISTS (SELECT 1 FROM public.package_credit_ledger r WHERE r.order_id = o.id AND r.event_type = 'restored')
  FROM public.package_credit_ledger l
  JOIN public.package_purchases p ON p.id = l.purchase_id
  JOIN public.snow_orders o ON o.id = l.order_id
  WHERE p.customer_id = auth.uid() AND l.event_type = 'reserved'
  ORDER BY o.created_at DESC, o.id DESC;
$$;
REVOKE ALL ON FUNCTION public.my_package_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_package_orders() TO authenticated;

-- A package order and its credit reservation are written together. Device IDs support
-- legacy order history only; access to package credits is determined by auth.uid().
CREATE FUNCTION public.create_package_order(
  p_purchase_id uuid,
  p_request_id uuid,
  p_device_id text,
  p_name text,
  p_phone text,
  p_info text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lon double precision DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  purchase public.package_purchases%ROWTYPE;
  existing public.package_credit_ledger%ROWTYPE;
  order_id integer;
  balance integer;
  request_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_purchase_id IS NULL OR p_request_id IS NULL OR p_device_id IS NULL OR
     length(trim(p_device_id)) NOT BETWEEN 1 AND 200 OR
     p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 200 OR
     p_phone IS NULL OR length(trim(p_phone)) NOT BETWEEN 1 AND 40 OR
     length(COALESCE(p_info, '')) > 2000 OR
     (p_lat IS NULL) <> (p_lon IS NULL) OR
     (p_lat IS NOT NULL AND (p_lat NOT BETWEEN -90 AND 90 OR p_lon NOT BETWEEN -180 AND 180)) THEN
    RAISE EXCEPTION 'Invalid order details';
  END IF;

  SELECT * INTO purchase FROM public.package_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND OR purchase.customer_id <> auth.uid() THEN RAISE EXCEPTION 'Package not found'; END IF;

  request_payload := jsonb_build_object(
    'device_id', trim(p_device_id), 'name', trim(p_name), 'phone', trim(p_phone),
    'info', NULLIF(trim(p_info), ''), 'lat', p_lat, 'lon', p_lon
  );
  SELECT * INTO existing FROM public.package_credit_ledger WHERE request_id = p_request_id;
  IF FOUND THEN
    IF existing.purchase_id <> p_purchase_id OR existing.request_payload <> request_payload THEN
      RAISE EXCEPTION 'Order request conflict';
    END IF;
    RETURN existing.order_id;
  END IF;
  IF purchase.payment_status <> 'paid' OR purchase.expires_at <= now() THEN
    RAISE EXCEPTION 'Package unavailable or expired';
  END IF;
  SELECT COALESCE(sum(delta), 0)::integer INTO balance
    FROM public.package_credit_ledger WHERE purchase_id = p_purchase_id;
  IF balance <= 0 THEN RAISE EXCEPTION 'No package credits remain'; END IF;

  INSERT INTO public.snow_orders (device_id, palvelu, address, phone, name, price, info, lat, lon, jatkuva_tilaus, is_free_order, status)
  VALUES (trim(p_device_id), 'Lumityö', purchase.service_address, trim(p_phone), trim(p_name), '0 €',
          NULLIF(trim(p_info), ''), p_lat, p_lon, false, false, 'odottaa')
  RETURNING id INTO order_id;
  INSERT INTO public.package_credit_ledger (purchase_id, event_type, delta, order_id, request_id, request_payload, remaining_after)
    VALUES (p_purchase_id, 'reserved', -1, order_id, p_request_id, request_payload, balance - 1);
  RETURN order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_package_order(uuid, uuid, text, text, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_package_order(uuid, uuid, text, text, text, text, double precision, double precision) TO authenticated;

CREATE FUNCTION public.complete_package_order(p_order_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  reservation public.package_credit_ledger%ROWTYPE;
BEGIN
  SELECT * INTO reservation FROM public.package_credit_ledger
    WHERE order_id = p_order_id AND event_type = 'reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Package reservation not found'; END IF;
  PERFORM 1 FROM public.package_purchases WHERE id = reservation.purchase_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.package_credit_ledger WHERE order_id = p_order_id AND event_type = 'completed') THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.package_credit_ledger WHERE order_id = p_order_id AND event_type = 'restored') THEN
    RAISE EXCEPTION 'Package reservation was restored';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.snow_orders WHERE id = p_order_id AND status = 'kuitattu') THEN
    RAISE EXCEPTION 'Order has not been completed';
  END IF;
  INSERT INTO public.package_credit_ledger (purchase_id, event_type, delta, order_id)
    VALUES (reservation.purchase_id, 'completed', 0, p_order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_package_order(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_package_order(integer) TO service_role;

-- Case-by-case restoration is only callable by trusted staff-side code.
CREATE FUNCTION public.restore_package_credit(p_order_id integer, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  reservation public.package_credit_ledger%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Restoration reason is required';
  END IF;
  SELECT * INTO reservation FROM public.package_credit_ledger
    WHERE order_id = p_order_id AND event_type = 'reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Package reservation not found'; END IF;
  PERFORM 1 FROM public.package_purchases WHERE id = reservation.purchase_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.package_credit_ledger WHERE order_id = p_order_id AND event_type = 'restored') THEN
    RAISE EXCEPTION 'Credit already restored';
  END IF;
  INSERT INTO public.package_credit_ledger (purchase_id, event_type, delta, order_id, reason)
    VALUES (reservation.purchase_id, 'restored', 1, p_order_id, trim(p_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.restore_package_credit(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_package_credit(integer, text) TO service_role;
