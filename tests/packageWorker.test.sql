-- Run only against a new disposable PostgreSQL database:
-- psql -X -v ON_ERROR_STOP=1 "$TEST_DATABASE_URL" -f tests/packageWorker.test.sql
\ir packagePayments.test.sql
ALTER TABLE public.snow_orders ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN notes text;
CREATE TABLE public.address_profiles (
  id serial PRIMARY KEY, address text NOT NULL,
  address_normalized text GENERATED ALWAYS AS (lower(trim(address))) STORED UNIQUE,
  primary_phone text, primary_email text
);
CREATE TABLE public.order_visits (
  id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES public.snow_orders(id),
  address_profile_id integer REFERENCES public.address_profiles(id), visit_date date NOT NULL,
  snow_amount text NOT NULL, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  address_profile_id integer NOT NULL REFERENCES public.address_profiles(id),
  invoice_date date NOT NULL, due_date date NOT NULL, period_start date NOT NULL, period_end date NOT NULL,
  line_items jsonb, subtotal numeric(10,2), tax_percent numeric(5,2), tax_amount numeric(10,2),
  total_amount numeric(10,2), status text, payment_date date, payment_method text,
  customer_name text, customer_email text, customer_phone text
);
GRANT SELECT, UPDATE, DELETE ON public.snow_orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_visits, public.invoices TO anon;
\ir ../supabase/migrations/202611140002_package_worker.sql

UPDATE public.package_purchases SET expires_at = now() + interval '1 year'
  WHERE id = '20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT public.create_package_order('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000099', 'device', 'Test', '123') AS package_order \gset
RESET ROLE;
SET ROLE anon;
SELECT public.test_expect_error('UPDATE public.snow_orders SET status = ''kuitattu'' WHERE id = ' || :package_order, 'approved work device');
SELECT public.test_expect_error('INSERT INTO public.order_visits (id, order_id, visit_date, snow_amount) VALUES (999, ' || :package_order || ', current_date, ''pieni'')', 'approved work device');
SELECT public.test_expect_error('SELECT public.worker_is_package_order(' || :package_order || ')', 'permission denied');
RESET ROLE;
SELECT updated_at AS expected_updated_at FROM public.snow_orders WHERE id = :package_order \gset
SET ROLE service_role;
SELECT public.test_assert(public.worker_is_package_order(:package_order), 'worker can identify prepaid order');
SELECT public.test_expect_error(
  'SELECT public.worker_save_package_order(' || :package_order || ', ' || quote_literal(:'expected_updated_at') || ', ''{"lat":91,"lon":25}'')',
  'Invalid order details');
SELECT (public.worker_save_package_order(:package_order, :'expected_updated_at', '{"status":"kuitattu","notes":"Valmis","lat":65,"lon":25}')).id;
RESET ROLE;
SELECT public.test_assert((SELECT lat = 65 AND lon = 25 AND address = 'Testikatu 1, Oulu' FROM public.snow_orders WHERE id = :package_order), 'geocoding preserves purchased address');
SET ROLE service_role;
SELECT (public.worker_add_package_visit(:package_order, '50000000-0000-0000-0000-000000000001', current_date, 'pieni', 'test')).id AS package_visit \gset
SELECT public.test_assert(
  (public.worker_add_package_visit(:package_order, '50000000-0000-0000-0000-000000000001', current_date, 'pieni', 'test')).id = :package_visit,
  'visit retry returns the original visit');
SELECT public.test_expect_error(
  'SELECT public.worker_add_package_visit(' || :package_order || ', ''50000000-0000-0000-0000-000000000002'', current_date, ''pieni'', ''test'')',
  'Existing visit requires review');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) = 1 FROM public.package_credit_ledger WHERE order_id = :package_order AND event_type = 'completed'), 'Map completion and Pro visit count once');
SELECT address_profile_id AS profile_id FROM public.order_visits WHERE id = :package_visit \gset
SET ROLE anon;
SELECT public.test_expect_error('DELETE FROM public.order_visits WHERE id = ' || :package_visit, 'approved work device');
SELECT public.test_expect_error(
  'INSERT INTO public.invoices (address_profile_id, invoice_date, due_date, period_start, period_end) VALUES (' || :profile_id || ', current_date, current_date, current_date, current_date)',
  'approved work device');
RESET ROLE;
SET ROLE service_role;
SELECT public.test_expect_error('SELECT public.worker_generate_invoice(''60000000-0000-0000-0000-000000000001'', ' || :profile_id || ', current_date, current_date, 14, 0)', 'No billable visits');
RESET ROLE;
INSERT INTO public.snow_orders (device_id, palvelu, address, name, phone, is_free_order, status)
  VALUES ('regular', 'Lumityö', 'Testikatu 1, Oulu', 'Test', '123', false, 'kuitattu') RETURNING id AS regular_order \gset
INSERT INTO public.order_visits (order_id, address_profile_id, visit_date, snow_amount)
  VALUES (:regular_order, :profile_id, current_date, 'pieni');
SET ROLE service_role;
SELECT (public.worker_generate_invoice('60000000-0000-0000-0000-000000000001', :profile_id, current_date, current_date, 14, 0)).id AS invoice_id \gset
SELECT public.test_assert((public.worker_generate_invoice('60000000-0000-0000-0000-000000000001', :profile_id, current_date, current_date, 14, 0)).id = :invoice_id, 'invoice retry returns original invoice');
SELECT public.test_expect_error(
  'SELECT public.worker_generate_invoice(''60000000-0000-0000-0000-000000000001'', ' || :profile_id || ', current_date, current_date, 15, 0)',
  'Invoice request conflict');
RESET ROLE;
SELECT public.test_assert((SELECT subtotal = 15 AND total_amount = 15 FROM public.invoices WHERE id = :invoice_id), 'invoice excludes the prepaid visit');
