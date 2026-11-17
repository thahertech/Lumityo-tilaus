-- Run only against a new disposable PostgreSQL database with the dblink extension:
-- psql -X -v ON_ERROR_STOP=1 "$TEST_DATABASE_URL" -f tests/packageConcurrency.test.sql
\ir packagePayments.test.sql
CREATE EXTENSION dblink;
INSERT INTO public.package_purchases
  (id, customer_id, customer_email, service_address, device_id, phone, paytrail_stamp, paytrail_transaction_id, terms_version, terms_accepted_at)
VALUES
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   'test@example.invalid', 'Testikatu 3, Oulu', 'device-1', '123', 'stamp-3', '30000000-0000-0000-0000-000000000003', 'test', now());
SELECT public.confirm_package_payment('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', now());
SELECT public.create_package_order('20000000-0000-0000-0000-000000000003', gen_random_uuid(), 'device', 'Test', '123')
  FROM generate_series(1, 9);

SELECT dblink_connect('order_a', format('dbname=%L port=%L host=%L', current_database(), current_setting('port'), current_setting('unix_socket_directories')));
SELECT dblink_connect('order_b', format('dbname=%L port=%L host=%L', current_database(), current_setting('port'), current_setting('unix_socket_directories')));
SELECT dblink_exec('order_a', $$SET "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001'$$);
SELECT dblink_exec('order_b', $$SET "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001'$$);
CREATE TEMP TABLE concurrent_results (order_id integer);
BEGIN;
SELECT id FROM public.package_purchases WHERE id = '20000000-0000-0000-0000-000000000003' FOR UPDATE;
SELECT dblink_send_query('order_a', $$SELECT public.create_package_order('20000000-0000-0000-0000-000000000003', gen_random_uuid(), 'device', 'Test', '123')$$);
SELECT dblink_send_query('order_b', $$SELECT public.create_package_order('20000000-0000-0000-0000-000000000003', gen_random_uuid(), 'device', 'Test', '123')$$);
COMMIT;
INSERT INTO concurrent_results SELECT * FROM dblink_get_result('order_a', false) AS result(order_id integer);
INSERT INTO concurrent_results SELECT * FROM dblink_get_result('order_b', false) AS result(order_id integer);
SELECT * FROM dblink_get_result('order_a', false) AS result(order_id integer);
SELECT * FROM dblink_get_result('order_b', false) AS result(order_id integer);
SELECT public.test_assert((SELECT count(*) = 1 FROM concurrent_results), 'only one concurrent request reserves the last credit');
SELECT public.test_assert((SELECT sum(delta) = 0 FROM public.package_credit_ledger WHERE purchase_id = '20000000-0000-0000-0000-000000000003'), 'balance cannot go negative');

INSERT INTO public.package_purchases
  (id, customer_id, customer_email, service_address, device_id, phone, paytrail_stamp, paytrail_transaction_id, terms_version, terms_accepted_at)
VALUES
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
   'test@example.invalid', 'Testikatu 4, Oulu', 'device-1', '123', 'stamp-4', '30000000-0000-0000-0000-000000000004', 'test', now());
BEGIN;
SELECT id FROM public.package_purchases WHERE id = '20000000-0000-0000-0000-000000000004' FOR UPDATE;
SELECT dblink_send_query('order_a', $$SELECT public.confirm_package_payment('20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', now())$$);
SELECT dblink_send_query('order_b', $$SELECT public.confirm_package_payment('20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', now())$$);
COMMIT;
SELECT * FROM dblink_get_result('order_a') AS result(ignored text);
SELECT * FROM dblink_get_result('order_b') AS result(ignored text);
SELECT * FROM dblink_get_result('order_a') AS result(ignored text);
SELECT * FROM dblink_get_result('order_b') AS result(ignored text);
SELECT public.test_assert((SELECT count(*) = 1 AND sum(delta) = 10 FROM public.package_credit_ledger WHERE purchase_id = '20000000-0000-0000-0000-000000000004'), 'concurrent callbacks issue credits once');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.package_receipt_outbox WHERE purchase_id = '20000000-0000-0000-0000-000000000004'), 'concurrent callbacks queue one receipt');

CREATE TEMP TABLE receipt_claims (purchase_id uuid);
BEGIN;
SELECT purchase_id FROM public.package_receipt_outbox WHERE purchase_id = '20000000-0000-0000-0000-000000000004' FOR UPDATE;
SELECT dblink_send_query('order_a', $$UPDATE public.package_receipt_outbox SET state = 'sending', attempted_at = now() WHERE purchase_id = '20000000-0000-0000-0000-000000000004' AND state = 'pending' RETURNING purchase_id$$);
SELECT dblink_send_query('order_b', $$UPDATE public.package_receipt_outbox SET state = 'sending', attempted_at = now() WHERE purchase_id = '20000000-0000-0000-0000-000000000004' AND state = 'pending' RETURNING purchase_id$$);
COMMIT;
INSERT INTO receipt_claims SELECT * FROM dblink_get_result('order_a') AS result(purchase_id uuid);
INSERT INTO receipt_claims SELECT * FROM dblink_get_result('order_b') AS result(purchase_id uuid);
SELECT public.test_assert((SELECT count(*) = 1 FROM receipt_claims), 'only one worker claims a receipt');
SELECT dblink_disconnect('order_a');
SELECT dblink_disconnect('order_b');
