/// <reference lib="deno.ns" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const encoder = new TextEncoder();
const message = encoder.encode('lumityot-package-cancellation-worker');

async function authorized(expected: string, provided: string) {
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const expectedKey = await crypto.subtle.importKey('raw', encoder.encode(expected), algorithm, false, ['verify']);
  const providedKey = await crypto.subtle.importKey('raw', encoder.encode(provided), algorithm, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', providedKey, message);
  return crypto.subtle.verify('HMAC', expectedKey, signature, message);
}

const reply = (status: number, error?: string) => new Response(error ? JSON.stringify({ error }) : null, {
  status, headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
});

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return reply(405, 'method_not_allowed');
  if (Deno.env.get('PACKAGE_CANCELLATION_DELIVERY_ENABLED') !== 'true') return reply(503, 'delivery_unavailable');
  const secret = Deno.env.get('CANCELLATION_WORKER_SECRET');
  const supplied = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!secret || secret.length < 32) return reply(503, 'delivery_unavailable');
  if (!supplied || supplied.length > 512 || !await authorized(secret, supplied)) return reply(401, 'unauthorized');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const service = Deno.env.get('CANCELLATION_EMAILJS_SERVICE_ID');
  const template = Deno.env.get('CANCELLATION_EMAILJS_TEMPLATE_ID');
  const publicKey = Deno.env.get('CANCELLATION_EMAILJS_PUBLIC_KEY');
  const privateKey = Deno.env.get('CANCELLATION_EMAILJS_PRIVATE_KEY');
  const supportEmail = Deno.env.get('CANCELLATION_SUPPORT_EMAIL');
  if (!url || !key || !service || !template || !publicKey || !privateKey || !supportEmail) {
    console.error('Cancellation email configuration is incomplete');
    return reply(503, 'delivery_unavailable');
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: item, error } = await supabase.from('package_cancellation_requests')
      .select('id,customer_name,customer_email,contract_details,received_at,customer_delivery,support_delivery')
      .or('customer_delivery.eq.pending,support_delivery.eq.pending').order('received_at').limit(1).maybeSingle();
    if (error) throw error;
    if (!item) return reply(204);
    const channel = item.customer_delivery === 'pending' ? 'customer' : 'support';
    const statusColumn = `${channel}_delivery`;
    const attemptedColumn = `${channel}_attempted_at`;
    const sentColumn = `${channel}_sent_at`;
    const { data: claimed, error: claimError } = await supabase.from('package_cancellation_requests')
      .update({ [statusColumn]: 'sending', [attemptedColumn]: new Date().toISOString() })
      .eq('id', item.id).eq(statusColumn, 'pending').select('id').maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return reply(204);
    const received = new Intl.DateTimeFormat('fi-FI', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Helsinki',
    }).format(new Date(item.received_at));
    const content = `Peruuttamisilmoitus\nNimi: ${item.customer_name}\nSopimus: ${item.contract_details}\nVastaanotettu: ${received} (Suomen aikaa)\nTunniste: ${item.id}`;
    const body = channel === 'customer'
      ? `${content}\n\nIlmoituksesi on vastaanotettu. Mahdollinen maksun palautus käsitellään erikseen.`
      : `${content}\nSähköposti: ${item.customer_email}\n\nKäsittele ilmoitus ja mahdollinen palautus erikseen.`;
    let delivery: Response;
    try {
      delivery = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          service_id: service, template_id: template, user_id: publicKey, accessToken: privateKey,
          template_params: {
            to_email: channel === 'customer' ? item.customer_email : supportEmail,
            subject: channel === 'customer' ? 'Vahvistus peruuttamisilmoituksesta' : 'Uusi peruuttamisilmoitus',
            message: body,
          },
        }),
        redirect: 'error', signal: AbortSignal.timeout(15000),
      });
    } catch {
      const { error: updateError } = await supabase.from('package_cancellation_requests')
        .update({ [statusColumn]: 'needs_review' }).eq('id', item.id).eq(statusColumn, 'sending');
      if (updateError) throw updateError;
      console.error('Cancellation email outcome unknown; manual review required');
      return reply(503, 'delivery_unknown');
    }
    if (!delivery.ok) {
      const { error: updateError } = await supabase.from('package_cancellation_requests')
        .update({ [statusColumn]: 'needs_review' }).eq('id', item.id).eq(statusColumn, 'sending');
      if (updateError) throw updateError;
      console.error('Cancellation email rejected; manual review required');
      return reply(503, 'delivery_rejected');
    }
    const { error: sentError } = await supabase.from('package_cancellation_requests')
      .update({ [statusColumn]: 'sent', [sentColumn]: new Date().toISOString() })
      .eq('id', item.id).eq(statusColumn, 'sending');
    if (sentError) throw sentError;
    return reply(204);
  } catch {
    console.error('Cancellation delivery failed; inspect pending and sending requests');
    return reply(503, 'delivery_failed');
  }
});
