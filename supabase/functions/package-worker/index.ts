/// <reference lib="deno.ns" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const tokenFormat = /^[0-9a-f]{64}$/i;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;
const encoder = new TextEncoder();
const message = encoder.encode('lumityot-package-work-device');

async function matchesToken(expected: string, provided: string) {
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const expectedKey = await crypto.subtle.importKey('raw', encoder.encode(expected), algorithm, false, ['verify']);
  const providedKey = await crypto.subtle.importKey('raw', encoder.encode(provided), algorithm, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', providedKey, message);
  return crypto.subtle.verify('HMAC', expectedKey, signature, message);
}

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
  });
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (Deno.env.get('PACKAGE_WORKER_ENABLED') !== 'true') return reply(503, { error: 'worker_unavailable' });
  const app = request.headers.get('x-package-app');
  const provided = request.headers.get('x-package-device-token');
  if (app !== 'map' && app !== 'pro') return reply(401, { error: 'unauthorized' });
  const expected = Deno.env.get(app === 'map' ? 'PACKAGE_MAP_DEVICE_TOKEN' : 'PACKAGE_PRO_DEVICE_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!expected || !tokenFormat.test(expected) || !supabaseUrl || !serviceKey) {
    console.error('Package work-device configuration is incomplete');
    return reply(503, { error: 'worker_unavailable' });
  }
  if (!provided || !tokenFormat.test(provided) || !await matchesToken(expected, provided)) {
    return reply(401, { error: 'unauthorized' });
  }
  const raw = await request.text();
  if (raw.length > 8192) return reply(413, { error: 'invalid_request' });
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { return reply(400, { error: 'invalid_request' }); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, { error: 'invalid_request' });
  if (input.action === 'approve') return reply(200, { approved: true });

  let procedure: string;
  let args: Record<string, unknown>;
  if (input.action === 'inspect' && positiveInteger(input.orderId)) {
    procedure = 'worker_is_package_order';
    args = { p_order_id: input.orderId };
  } else if (input.action === 'save_order' && app === 'map' && positiveInteger(input.orderId) &&
      (input.expectedUpdatedAt === null || typeof input.expectedUpdatedAt === 'string') &&
      input.patch && typeof input.patch === 'object' && !Array.isArray(input.patch)) {
    procedure = 'worker_save_package_order';
    args = { p_order_id: input.orderId, p_expected_updated_at: input.expectedUpdatedAt, p_patch: input.patch };
  } else if (input.action === 'add_visit' && app === 'pro' && positiveInteger(input.orderId) &&
      typeof input.requestId === 'string' && uuid.test(input.requestId) &&
      typeof input.visitDate === 'string' && date.test(input.visitDate) &&
      (input.snowAmount === 'pieni' || input.snowAmount === 'iso') &&
      (input.notes === null || typeof input.notes === 'string')) {
    procedure = 'worker_add_package_visit';
    args = { p_order_id: input.orderId, p_request_id: input.requestId, p_visit_date: input.visitDate, p_snow_amount: input.snowAmount, p_notes: input.notes };
  } else if (input.action === 'generate_invoice' && app === 'pro' &&
      typeof input.requestId === 'string' && uuid.test(input.requestId) && positiveInteger(input.profileId) &&
      typeof input.periodStart === 'string' && date.test(input.periodStart) &&
      typeof input.periodEnd === 'string' && date.test(input.periodEnd) &&
      typeof input.daysUntilDue === 'number' && Number.isInteger(input.daysUntilDue) &&
      typeof input.taxPercent === 'number' && Number.isFinite(input.taxPercent)) {
    procedure = 'worker_generate_invoice';
    args = { p_request_id: input.requestId, p_profile_id: input.profileId, p_period_start: input.periodStart, p_period_end: input.periodEnd, p_days_until_due: input.daysUntilDue, p_tax_percent: input.taxPercent };
  } else if (input.action === 'update_invoice' && app === 'pro' && positiveInteger(input.invoiceId) &&
      typeof input.status === 'string' && (input.paymentMethod === null || typeof input.paymentMethod === 'string')) {
    procedure = 'worker_update_invoice_status';
    args = { p_invoice_id: input.invoiceId, p_status: input.status, p_payment_method: input.paymentMethod };
  } else {
    return reply(400, { error: 'invalid_request' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc(procedure, args);
  if (error) {
    console.error('Package worker operation failed:', error.code);
    const messages: Record<string, string> = {
      'Order changed; refresh before saving': 'Kohde on muuttunut. Päivitä tiedot ennen tallentamista.',
      'Order is cancelled': 'Asiakas on peruuttanut tilauksen.',
      'Package order is unavailable': 'Pakettitilaus ei ole käytettävissä.',
      'Existing visit requires review': 'Kohteella on jo käynti. Tarkista tiedot ennen jatkamista.',
      'Package visit needs manual review': 'Pakettikäynti on tarkistettava ennen laskutusta.',
      'No billable visits in period': 'Valitulla kaudella ei ole laskutettavia käyntejä.',
      'Invalid package order status': 'Pakettityön tilaa ei voi muuttaa tällä tavalla.',
      'Invalid visit details': 'Tarkista käynnin tiedot.',
      'Invalid invoice details': 'Tarkista laskun tiedot.',
    };
    if (error.code === 'P0001' && messages[error.message]) {
      return reply(409, { error: 'operation_rejected', message: messages[error.message] });
    }
    return reply(503, { error: 'operation_unconfirmed', message: 'Toiminnon tulosta ei voitu vahvistaa. Yritä uudelleen samoilla tiedoilla.' });
  }
  if (procedure === 'worker_is_package_order') {
    if (typeof data !== 'boolean') return reply(503, { error: 'invalid_response' });
    return reply(200, { data });
  }
  const row = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
  if (!row || typeof row !== 'object' || Array.isArray(row)) return reply(503, { error: 'invalid_response' });
  return reply(200, { data: row });
});
