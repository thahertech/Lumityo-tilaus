/// <reference lib="deno.ns" />

const APP_RETURN_URL = 'lumityot://payment-return?openPackage=true&requestId=paytrail-return';

Deno.serve(async (request: Request) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET', 'cache-control': 'no-store' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    console.error('Paytrail return could not process the payment callback');
    return new Response('Payment return is unavailable. Reopen Lumityöt to check the payment.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  // Process the signed Paytrail response through the same server-side verifier
  // used by Paytrail callbacks before returning the customer to the app.
  try {
    const callbackUrl = new URL('/functions/v1/paytrail-callback', supabaseUrl);
    callbackUrl.search = new URL(request.url).search;
    const callbackResponse = await fetch(callbackUrl, { method: 'GET', redirect: 'manual' });
    if (!callbackResponse.ok) {
      console.error('Paytrail return callback processing returned status', callbackResponse.status);
    }
  } catch {
    console.error('Paytrail return callback processing failed');
  }

  return new Response(null, {
    status: 302,
    headers: { Location: APP_RETURN_URL, 'cache-control': 'no-store' },
  });
});
