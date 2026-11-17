import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { verifyPaytrailCallback } from '../_shared/paytrailSignature.mjs';
import { getPaytrailPayment } from '../_shared/paytrailClient.mjs';
import { parsePaytrailPaidAt } from '../_shared/paytrailTime.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(status: number) {
  return new Response(null, { status, headers: { 'cache-control': 'no-store' } });
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'GET') return reply(405);
  if (request.url.length > 8192) return reply(400);

  const account = Deno.env.get('PAYTRAIL_MERCHANT_ID');
  const secret = Deno.env.get('PAYTRAIL_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!account || !secret || !supabaseUrl || !serviceKey) {
    console.error('Paytrail callback server configuration is incomplete');
    return reply(503);
  }

  const params = new URL(request.url).searchParams;
  const stamp = params.get('checkout-stamp');
  const transactionId = params.get('checkout-transaction-id');
  if (!stamp || !transactionId || !uuid.test(transactionId)) return reply(400);

  let status: string;
  try {
    ({ status } = await verifyPaytrailCallback(secret, params, {
      account, stamp, transactionId, amount: '15000',
    }));
  } catch {
    return reply(400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data: purchase, error: purchaseError } = await supabase
      .from('package_purchases')
      .select('id, paytrail_transaction_id, amount_cents, currency')
      .eq('paytrail_stamp', stamp)
      .maybeSingle();
    if (purchaseError) throw purchaseError;
    if (!purchase || purchase.amount_cents !== 15000 || purchase.currency !== 'EUR') return reply(400);
    if (purchase.paytrail_transaction_id && purchase.paytrail_transaction_id !== transactionId) return reply(400);

    if (!purchase.paytrail_transaction_id) {
      const { data: linked, error } = await supabase.from('package_purchases')
        .update({ paytrail_transaction_id: transactionId })
        .eq('id', purchase.id)
        .is('paytrail_transaction_id', null)
        .select('paytrail_transaction_id')
        .maybeSingle();
      if (error) throw error;
      if (!linked) {
        const { data: current, error: currentError } = await supabase.from('package_purchases')
          .select('paytrail_transaction_id')
          .eq('id', purchase.id)
          .single();
        if (currentError) throw currentError;
        if (current.paytrail_transaction_id !== transactionId) return reply(400);
      }
    }

    if (status !== 'ok') {
      const { error } = await supabase.from('package_purchases')
        .update({ payment_status: status })
        .eq('id', purchase.id)
        .eq('paytrail_transaction_id', transactionId)
        .in('payment_status', ['new', 'pending', 'delayed']);
      if (error) throw error;
      return reply(200);
    }

    const payment = await getPaytrailPayment({ account, secret }, transactionId);
    if (payment.transactionId !== transactionId || payment.stamp !== stamp ||
        payment.amount !== 15000 || payment.currency !== 'EUR') {
      console.error('Paytrail transaction details do not match the stored purchase');
      return reply(400);
    }
    if (payment.status !== 'ok') {
      console.error('Paytrail transaction is not yet confirmed');
      return reply(503);
    }
    let paidAt: string;
    try {
      paidAt = parsePaytrailPaidAt(payment.paidAt);
    } catch {
      console.error('Paytrail payment timestamp is missing, invalid or lacks a timezone; reconcile manually');
      return reply(503);
    }
    const { error } = await supabase.rpc('confirm_package_payment', {
      p_purchase_id: purchase.id,
      p_transaction_id: transactionId,
      p_paid_at: paidAt,
    });
    if (error) throw error;
    return reply(200);
  } catch {
    console.error('Paytrail callback could not be processed; retry or reconcile the payment');
    return reply(503);
  }
});
