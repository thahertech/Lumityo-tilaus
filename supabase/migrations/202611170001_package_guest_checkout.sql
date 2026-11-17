-- Return the unverified receipt address when resuming an unfinished checkout.
-- Package migrations are development-only; apply this after 202611140001 if
-- that migration has already been applied to an isolated test project.
DROP FUNCTION IF EXISTS public.my_unresolved_package_checkout();

CREATE FUNCTION public.my_unresolved_package_checkout()
RETURNS TABLE (
  id uuid,
  customer_email text,
  service_address text,
  device_id text,
  phone text,
  terms_version text,
  payment_status text
)
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
