/// <reference lib="deno.ns" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { createPaytrailPayment } from '../_shared/paytrailClient.mjs';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
  'content-type': 'application/json',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function httpsUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (Deno.env.get('PACKAGE_CHECKOUT_ENABLED') !== 'true') return reply(503, { error: 'checkout_unavailable' });

  const account = Deno.env.get('PAYTRAIL_MERCHANT_ID')?.trim();
  const secret = Deno.env.get('PAYTRAIL_SECRET')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const termsVersion = Deno.env.get('PACKAGE_TERMS_VERSION')?.trim();
  const vatSetting = Deno.env.get('PACKAGE_VAT_PERCENTAGE');
  const vat = vatSetting === undefined || !/^\d{1,3}(\.\d{1,2})?$/.test(vatSetting) ? NaN : Number(vatSetting);
  const successUrlValue = Deno.env.get('PAYTRAIL_REDIRECT_SUCCESS_URL');
  const cancelUrlValue = Deno.env.get('PAYTRAIL_REDIRECT_CANCEL_URL');
  const callbackUrlValue = Deno.env.get('PAYTRAIL_CALLBACK_URL');
  const successUrl = httpsUrl(successUrlValue);
  const cancelUrl = httpsUrl(cancelUrlValue);
  const callbackUrl = httpsUrl(callbackUrlValue);
  const invalidConfig = [
    !account && 'PAYTRAIL_MERCHANT_ID',
    !secret && 'PAYTRAIL_SECRET',
    !supabaseUrl && 'SUPABASE_URL',
    !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !termsVersion && 'PACKAGE_TERMS_VERSION',
    (!Number.isFinite(vat) || vat < 0 || vat > 100) && 'PACKAGE_VAT_PERCENTAGE',
    !successUrl && 'PAYTRAIL_REDIRECT_SUCCESS_URL',
    !cancelUrl && 'PAYTRAIL_REDIRECT_CANCEL_URL',
    !callbackUrl && 'PAYTRAIL_CALLBACK_URL',
  ].filter((name): name is string => Boolean(name));
  if (invalidConfig.length > 0) {
    console.error('Package checkout configuration missing or invalid:', invalidConfig.join(', '));
    return reply(503, { error: 'checkout_unavailable' });
  }

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401, { error: 'authentication_required' });
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user?.id) return reply(401, { error: 'authentication_required' });

  const raw = await request.text();
  if (raw.length > 4096) return reply(413, { error: 'invalid_request' });
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'invalid_request' });
  }
  if (!input || typeof input.checkoutId !== 'string' || !uuid.test(input.checkoutId) ||
      typeof input.address !== 'string' || input.address.trim().length < 5 ||
      input.address.trim().length > 250 || /[\u0000-\u001f\u007f]/.test(input.address) ||
      typeof input.deviceId !== 'string' || input.deviceId.trim().length < 1 ||
      input.deviceId.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(input.deviceId) ||
      typeof input.phone !== 'string' || input.phone.trim().length < 1 ||
      input.phone.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(input.phone) ||
      typeof input.email !== 'string' || input.email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || /[\u0000-\u001f\u007f]/.test(input.email) ||
      input.termsVersion !== termsVersion) {
    return reply(400, { error: 'invalid_request' });
  }
  const checkoutId = input.checkoutId;
  const address = input.address.trim();
  const deviceId = input.deviceId.trim();
  const phone = input.phone.trim();
  const receiptEmail = input.email.trim().toLowerCase();

  let stage = 'persist_purchase';
  try {
    const { error: createError } = await supabase.from('package_purchases').insert({
      id: checkoutId,
      customer_id: user.id,
      customer_email: receiptEmail,
      service_address: address,
      device_id: deviceId,
      phone,
      paytrail_stamp: checkoutId,
      terms_version: termsVersion,
      terms_accepted_at: new Date().toISOString(),
    });
    if (createError && createError.code !== '23505') throw createError;

    const { data: purchase, error: loadError } = await supabase.from('package_purchases')
      .select('id, customer_id, customer_email, service_address, device_id, phone, terms_version, checkout_url, checkout_started_at, payment_status')
      .eq('id', checkoutId).maybeSingle();
    if (loadError) throw loadError;
    if (!purchase || purchase.customer_id !== user.id ||
        purchase.service_address !== address || purchase.device_id !== deviceId ||
        purchase.phone !== phone || purchase.customer_email !== receiptEmail || purchase.terms_version !== termsVersion) {
      return reply(409, { error: 'checkout_conflict' });
    }
    if (purchase.payment_status === 'paid') return reply(200, { status: 'paid' });
    if (purchase.payment_status !== 'new') return reply(200, { status: purchase.payment_status });
    if (purchase.checkout_url) return reply(200, { status: 'new', checkoutUrl: purchase.checkout_url });
    if (purchase.checkout_started_at) return reply(409, { error: 'checkout_pending_reconciliation' });

    const { data: claimed, error: claimError } = await supabase.from('package_purchases')
      .update({ checkout_started_at: new Date().toISOString() })
      .eq('id', checkoutId).is('checkout_started_at', null).eq('payment_status', 'new')
      .select('id').maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return reply(409, { error: 'checkout_pending_reconciliation' });

    stage = 'paytrail_create';
    const payment = await createPaytrailPayment({ account, secret }, {
      stamp: checkoutId,
      reference: checkoutId,
      amount: 15000,
      currency: 'EUR',
      language: 'FI',
      items: [{ unitPrice: 15000, units: 1, vatPercentage: vat, productCode: 'lumityo-10', description: 'Lumityöpaketti, 10 kertaa' }],
      customer: { email: receiptEmail },
      redirectUrls: { success: successUrl, cancel: cancelUrl },
      callbackUrls: { success: callbackUrl, cancel: callbackUrl },
    });
    stage = 'validate_paytrail_response';
    const paymentUrl = httpsUrl(typeof payment.href === 'string' ? payment.href : undefined);
    const host = paymentUrl ? new URL(paymentUrl).hostname : '';
    if (typeof payment.transactionId !== 'string' || !uuid.test(payment.transactionId) ||
        !paymentUrl || !['services.paytrail.com', 'pay.paytrail.com'].includes(host)) {
      throw new Error('Invalid Paytrail checkout response');
    }
    stage = 'save_checkout_url';
    const { data: updated, error: updateError } = await supabase.from('package_purchases')
      .update({ paytrail_transaction_id: payment.transactionId, checkout_url: paymentUrl })
      .eq('id', checkoutId)
      .or(`paytrail_transaction_id.is.null,paytrail_transaction_id.eq.${payment.transactionId}`)
      .select('id, payment_status').maybeSingle();
    if (updateError) throw updateError;
    if (!updated) throw new Error('Paytrail transaction mismatch');
    if (updated.payment_status !== 'new') return reply(200, { status: updated.payment_status });
    return reply(200, { status: 'new', checkoutUrl: paymentUrl });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorCode = typeof error === 'object' && error !== null && 'code' in error &&
      typeof error.code === 'string' ? error.code : undefined;
    const providerStatus = error instanceof Error
      ? error.message.match(/^Paytrail request failed \(HTTP (\d{3})\)$/)?.[1]
      : undefined;
    console.error('Package checkout failed; stage:', stage, 'type:', errorName,
      'code:', errorCode ?? 'none', 'Paytrail HTTP status:', providerStatus ?? 'none');
    return reply(503, { error: 'checkout_pending_reconciliation' });
  }
});
