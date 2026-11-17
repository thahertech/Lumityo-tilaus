-- Development only. Deploy only with configured delivery, monitoring and rate limiting.
CREATE TABLE public.package_cancellation_requests (
  id uuid PRIMARY KEY,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  contract_details text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  customer_delivery text NOT NULL DEFAULT 'pending'
    CHECK (customer_delivery IN ('pending', 'sending', 'sent', 'needs_review')),
  support_delivery text NOT NULL DEFAULT 'pending'
    CHECK (support_delivery IN ('pending', 'sending', 'sent', 'needs_review')),
  customer_attempted_at timestamptz,
  support_attempted_at timestamptz,
  customer_sent_at timestamptz,
  support_sent_at timestamptz
);

ALTER TABLE public.package_cancellation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.package_cancellation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.package_cancellation_requests TO service_role;

CREATE FUNCTION public.record_package_cancellation(
  p_id uuid, p_name text, p_email text, p_contract text
)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  item public.package_cancellation_requests%ROWTYPE;
BEGIN
  IF p_id IS NULL OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 200
     OR p_email IS NULL OR length(trim(p_email)) NOT BETWEEN 3 AND 254
     OR p_contract IS NULL OR length(trim(p_contract)) NOT BETWEEN 1 AND 1000
     OR p_name ~ '[[:cntrl:]]' OR p_email ~ '[[:cntrl:]]' OR p_contract ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid cancellation details';
  END IF;
  INSERT INTO public.package_cancellation_requests (id, customer_name, customer_email, contract_details)
  VALUES (p_id, trim(p_name), trim(p_email), trim(p_contract))
  ON CONFLICT (id) DO NOTHING;
  SELECT * INTO item FROM public.package_cancellation_requests WHERE id = p_id;
  IF item.customer_name <> trim(p_name) OR item.customer_email <> trim(p_email)
     OR item.contract_details <> trim(p_contract) THEN
    RAISE EXCEPTION 'Cancellation request conflict';
  END IF;
  RETURN item.received_at;
END;
$$;
REVOKE ALL ON FUNCTION public.record_package_cancellation(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_package_cancellation(uuid, text, text, text) TO service_role;
