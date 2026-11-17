export function parsePaytrailPaidAt(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new Error('Paytrail payment timestamp must include a timezone');
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid Paytrail payment timestamp');
  return new Date(timestamp).toISOString();
}
