-- Run only against a new disposable PostgreSQL database, never production:
-- psql -X -v ON_ERROR_STOP=1 "$TEST_DATABASE_URL" -f tests/packagePayments.test.sql
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
CREATE TABLE public.snow_orders (
  id serial PRIMARY KEY,
  device_id text, palvelu text, address text, phone text, name text, price text,
  info text, lat double precision, lon double precision,
  jatkuva_tilaus boolean, is_free_order boolean, status text, created_at timestamptz DEFAULT now()
);
\ir ../supabase/migrations/202611140001_package_payments.sql

CREATE FUNCTION public.test_assert(condition boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', message; END IF;
END;
$$;
CREATE FUNCTION public.test_expect_error(statement text, expected text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    actual := SQLERRM;
  END;
  IF actual IS NULL OR position(expected IN actual) = 0 THEN
    RAISE EXCEPTION 'Expected error %, got %', expected, actual;
  END IF;
END;
$$;

INSERT INTO auth.users VALUES ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
INSERT INTO public.package_purchases
  (id, customer_id, customer_email, service_address, device_id, phone, paytrail_stamp, paytrail_transaction_id, terms_version, terms_accepted_at)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'test@example.invalid', 'Testikatu 1, Oulu', 'device-1', '123', 'stamp-1', '30000000-0000-0000-0000-000000000001', 'test', now()),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   'test2@example.invalid', 'Testikatu 2, Oulu', 'device-2', '456', 'stamp-2', '30000000-0000-0000-0000-000000000002', 'test', now());

SELECT public.test_expect_error(
  $$INSERT INTO public.package_purchases (customer_id, customer_email, service_address, device_id, phone, paytrail_stamp, terms_version, terms_accepted_at)
    VALUES ('10000000-0000-0000-0000-000000000001', 'test@example.invalid', 'Testikatu 3, Oulu', 'device-1', '123', 'stamp-extra', 'test', now())$$,
  'package_one_unresolved_checkout_per_customer');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.test_assert((SELECT count(*) = 1 AND min(service_address) = 'Testikatu 1, Oulu' AND min(device_id) = 'device-1' AND min(phone) = '123' FROM public.my_unresolved_package_checkout()), 'checkout recovery preserves private purchase details');
RESET ROLE;

SET ROLE service_role;
SELECT public.confirm_package_payment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now());
SELECT public.confirm_package_payment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now());
SELECT public.confirm_package_payment('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', now());
RESET ROLE;
SELECT public.test_assert((SELECT count(*) = 1 FROM public.package_credit_ledger WHERE purchase_id = '20000000-0000-0000-0000-000000000001'), 'issuance is idempotent');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.package_receipt_outbox WHERE purchase_id = '20000000-0000-0000-0000-000000000001'), 'one receipt per payment');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.test_assert((SELECT count(*) = 1 AND min(remaining) = 10 FROM public.my_snow_packages()), 'balance is private and starts at ten');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.my_unresolved_package_checkout()), 'paid checkout is no longer unresolved');
SELECT public.create_package_order('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'device', 'Test', '123') AS order_id \gset
SELECT public.test_assert((SELECT count(*) = 1 AND min(service_address) = 'Testikatu 1, Oulu' AND min(remaining_after) = 9 FROM public.my_package_orders()), 'package orders show the balance after reservation');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
SELECT public.test_assert((SELECT count(*) = 0 FROM public.my_package_orders()), 'package orders are hidden from other customers');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.test_assert(
  public.create_package_order('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'device', 'Test', '123') = :order_id,
  'retry returns the same order');
SELECT public.test_expect_error(
  $$SELECT public.create_package_order('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'device', 'Different', '123')$$,
  'Order request conflict');
SELECT public.test_expect_error(
  $$SELECT public.create_package_order('20000000-0000-0000-0000-000000000002', gen_random_uuid(), 'device', 'Test', '123')$$,
  'Package not found');
SELECT public.test_expect_error(
  $$SELECT public.create_package_order('20000000-0000-0000-0000-000000000001', gen_random_uuid(), 'device', 'Test', '123', NULL, 65, NULL)$$,
  'Invalid order details');
SELECT public.create_package_order('20000000-0000-0000-0000-000000000001', gen_random_uuid(), 'device', 'Test', '123')
  FROM generate_series(1, 9);
SELECT public.test_assert((SELECT remaining = 0 AND reserved = 10 AND completed = 0 FROM public.my_snow_packages()), 'reservations cannot overspend');
SELECT public.test_expect_error(
  $$SELECT public.create_package_order('20000000-0000-0000-0000-000000000001', gen_random_uuid(), 'device', 'Test', '123')$$,
  'No package credits remain');
SELECT public.test_expect_error(
  $$SELECT public.restore_package_credit(1, 'test')$$, 'permission denied');
RESET ROLE;
SELECT public.test_assert((SELECT address = 'Testikatu 1, Oulu' AND palvelu = 'Lumityö' AND price = '0 €' AND NOT is_free_order FROM public.snow_orders WHERE id = :order_id), 'order uses package address and service and shows zero price');
SELECT public.test_expect_error('DELETE FROM public.snow_orders WHERE id = ' || :order_id, 'foreign key constraint');

SET ROLE service_role;
SELECT public.test_expect_error('SELECT public.complete_package_order(' || :order_id || ')', 'Order has not been completed');
RESET ROLE;
UPDATE public.snow_orders SET status = 'kuitattu' WHERE id = :order_id;
SET ROLE service_role;
SELECT public.complete_package_order(:order_id);
SELECT public.complete_package_order(:order_id);
SELECT public.restore_package_credit(:order_id, 'Case reviewed');
SELECT public.test_expect_error('SELECT public.restore_package_credit(' || :order_id || ', ''again'')', 'Credit already restored');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) = 1 FROM public.package_credit_ledger WHERE order_id = :order_id AND event_type = 'completed'), 'completion is idempotent');
SET ROLE authenticated;
SELECT public.test_assert((SELECT remaining = 1 AND reserved = 9 AND completed = 0 FROM public.my_snow_packages()), 'restoration adds one available credit');
RESET ROLE;

UPDATE public.package_purchases SET expires_at = now() - interval '1 second'
  WHERE id = '20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT public.test_expect_error(
  $$SELECT public.create_package_order('20000000-0000-0000-0000-000000000001', gen_random_uuid(), 'device', 'Test', '123')$$,
  'Package unavailable or expired');
RESET ROLE;
