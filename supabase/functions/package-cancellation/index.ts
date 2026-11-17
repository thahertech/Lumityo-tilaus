/// <reference lib="deno.ns" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
  'content-type': 'application/json',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const controls = /[\u0000-\u001f\u007f]/;
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (Deno.env.get('PACKAGE_CANCELLATIONS_ENABLED') !== 'true' ||
      Deno.env.get('PACKAGE_CANCELLATION_DELIVERY_ENABLED') !== 'true') {
    return reply(503, { error: 'cancellation_unavailable' });
  }
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const required = ['CANCELLATION_EMAILJS_SERVICE_ID', 'CANCELLATION_EMAILJS_TEMPLATE_ID',
    'CANCELLATION_EMAILJS_PUBLIC_KEY', 'CANCELLATION_EMAILJS_PRIVATE_KEY',
    'CANCELLATION_SUPPORT_EMAIL', 'CANCELLATION_WORKER_SECRET'];
  if (!url || !key || required.some((name) => !Deno.env.get(name)) ||
      (Deno.env.get('CANCELLATION_WORKER_SECRET') || '').length < 32 ||
      !email.test(Deno.env.get('CANCELLATION_SUPPORT_EMAIL') || '')) {
    console.error('Cancellation delivery configuration is incomplete');
    return reply(503, { error: 'cancellation_unavailable' });
  }
  const raw = await request.text();
  if (raw.length > 4096) return reply(413, { error: 'invalid_request' });
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'invalid_request' });
  }
  if (!input || typeof input.id !== 'string' || !uuid.test(input.id) ||
      typeof input.name !== 'string' || input.name.trim().length < 1 || input.name.trim().length > 200 ||
      typeof input.email !== 'string' || input.email.trim().length > 254 || !email.test(input.email.trim()) ||
      typeof input.contract !== 'string' || input.contract.trim().length < 1 || input.contract.trim().length > 1000 ||
      controls.test(input.name) || controls.test(input.email) || controls.test(input.contract)) {
    return reply(400, { error: 'invalid_request' });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc('record_package_cancellation', {
    p_id: input.id, p_name: input.name.trim(), p_email: input.email.trim(), p_contract: input.contract.trim(),
  });
  if (error || typeof data !== 'string' || !Number.isFinite(Date.parse(data))) {
    console.error('Cancellation request could not be recorded');
    return reply(503, { error: 'cancellation_not_recorded' });
  }
  return reply(200, { receivedAt: data });
});
