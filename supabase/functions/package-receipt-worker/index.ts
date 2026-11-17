/// <reference lib="deno.ns" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const encoder = new TextEncoder();
const message = encoder.encode('lumityot-package-receipt-worker');

async function authorized(expected: string, provided: string) {
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const expectedKey = await crypto.subtle.importKey('raw', encoder.encode(expected), algorithm, false, ['verify']);
  const providedKey = await crypto.subtle.importKey('raw', encoder.encode(provided), algorithm, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', providedKey, message);
  return crypto.subtle.verify('HMAC', expectedKey, signature, message);
}

function response(status: number, error?: string) {
  return new Response(error ? JSON.stringify({ error }) : null, {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return response(405, 'method_not_allowed');
  if (Deno.env.get('PACKAGE_RECEIPTS_ENABLED') !== 'true') return response(503, 'receipts_unavailable');
  const workerSecret = Deno.env.get('PACKAGE_RECEIPT_WORKER_SECRET');
  const supplied = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!workerSecret || workerSecret.length < 32) {
    console.error('Receipt worker secret is not configured');
    return response(503, 'receipts_unavailable');
  }
  if (!supplied || supplied.length > 512 || !await authorized(workerSecret, supplied)) return response(401, 'unauthorized');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const serviceId = Deno.env.get('RECEIPT_EMAILJS_SERVICE_ID');
  const templateId = Deno.env.get('RECEIPT_EMAILJS_TEMPLATE_ID');
  const publicKey = Deno.env.get('RECEIPT_EMAILJS_PUBLIC_KEY');
  const privateKey = Deno.env.get('RECEIPT_EMAILJS_PRIVATE_KEY');
  if (!supabaseUrl || !serviceKey || !serviceId || !templateId || !publicKey || !privateKey) {
    console.error('Receipt delivery configuration is incomplete');
    return response(503, 'receipts_unavailable');
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: next, error: nextError } = await supabase.from('package_receipt_outbox')
      .select('purchase_id').eq('state', 'pending').order('created_at').limit(1).maybeSingle();
    if (nextError) throw nextError;
    if (!next) return response(204);
    const { data: claimed, error: claimError } = await supabase.from('package_receipt_outbox')
      .update({ state: 'sending', attempted_at: new Date().toISOString() })
      .eq('purchase_id', next.purchase_id).eq('state', 'pending')
      .select('purchase_id').maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return response(204);

    const { data: purchase, error: purchaseError } = await supabase.from('package_purchases')
      .select('id, customer_email, service_address, payment_status, paid_at, expires_at, paytrail_transaction_id')
      .eq('id', claimed.purchase_id).single();
    if (purchaseError) throw purchaseError;
    if (purchase.payment_status !== 'paid' || !purchase.paid_at || !purchase.expires_at || !purchase.paytrail_transaction_id) {
      throw new Error('Receipt purchase is not confirmed');
    }

    const date = (value: string) => new Intl.DateTimeFormat('fi-FI', { dateStyle: 'short', timeZone: 'Europe/Helsinki' }).format(new Date(value));
    let delivery: Response;
    try {
      delivery = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            to_email: purchase.customer_email,
            service_address: purchase.service_address,
            purchase_id: purchase.id,
            transaction_id: purchase.paytrail_transaction_id,
            paid_date: date(purchase.paid_at),
            expiry_date: date(purchase.expires_at),
            total: '150,00 €',
          },
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      const { error } = await supabase.from('package_receipt_outbox')
        .update({ state: 'needs_review', error_code: 'delivery_unknown' })
        .eq('purchase_id', claimed.purchase_id).eq('state', 'sending');
      if (error) throw error;
      console.error('Receipt delivery outcome is unknown; review before retry');
      return response(503, 'delivery_unknown');
    }
    if (!delivery.ok) {
      const { error } = await supabase.from('package_receipt_outbox')
        .update({ state: 'needs_review', error_code: 'provider_rejected' })
        .eq('purchase_id', claimed.purchase_id).eq('state', 'sending');
      if (error) throw error;
      console.error('Receipt provider rejected the delivery');
      return response(503, 'provider_rejected');
    }
    const { error: sentError } = await supabase.from('package_receipt_outbox')
      .update({ state: 'sent', sent_at: new Date().toISOString() })
      .eq('purchase_id', claimed.purchase_id).eq('state', 'sending');
    if (sentError) throw sentError;
    return response(204);
  } catch {
    console.error('Receipt processing failed; inspect the outbox before retry');
    return response(503, 'receipt_processing_failed');
  }
});
