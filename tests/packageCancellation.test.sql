-- Run only against a new disposable PostgreSQL database.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
\ir ../supabase/migrations/202611140003_package_cancellation.sql

DO $$
DECLARE
  first_time timestamptz;
  second_time timestamptz;
BEGIN
  IF has_table_privilege('anon', 'public.package_cancellation_requests', 'SELECT')
     OR has_function_privilege('anon', 'public.record_package_cancellation(uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous access exposes cancellation requests';
  END IF;
  first_time := public.record_package_cancellation('10000000-0000-0000-0000-000000000001', 'Test', 'test@example.invalid', 'Package');
  second_time := public.record_package_cancellation('10000000-0000-0000-0000-000000000001', 'Test', 'test@example.invalid', 'Package');
  IF first_time IS DISTINCT FROM second_time OR (SELECT count(*) FROM public.package_cancellation_requests) <> 1 THEN
    RAISE EXCEPTION 'Cancellation retry is not idempotent';
  END IF;
  BEGIN
    PERFORM public.record_package_cancellation('10000000-0000-0000-0000-000000000001', 'Other', 'test@example.invalid', 'Package');
    RAISE EXCEPTION 'Changed cancellation retry accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Cancellation request conflict' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.record_package_cancellation(gen_random_uuid(), '', 'test@example.invalid', 'Package');
    RAISE EXCEPTION 'Invalid cancellation accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid cancellation details' THEN RAISE; END IF;
  END;
END;
$$;
