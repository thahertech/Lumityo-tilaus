const assert = require('node:assert/strict');
const { createHmac, webcrypto } = require('node:crypto');
const test = require('node:test');

globalThis.crypto = webcrypto;
const modulePromise = import('../supabase/functions/_shared/paytrailSignature.mjs');
const secret = 'SAIPPUAKAUPPIAS';
const expected = { account: '375917', stamp: 'purchase-123', transactionId: 'transaction-123', amount: '15000' };

function callback(status = 'ok') {
  const params = new URLSearchParams({
    'checkout-status': status,
    'checkout-stamp': expected.stamp,
    'checkout-transaction-id': expected.transactionId,
    'checkout-amount': expected.amount,
    'checkout-algorithm': 'sha256',
    'checkout-account': expected.account,
    'checkout-extra-new-field': 'value',
  });
  const payload = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}:${value}`).concat('').join('\n');
  params.set('signature', createHmac('sha256', secret).update(payload).digest('hex'));
  return params;
}

test('signs the exact request body with all checkout headers sorted', async () => {
  const { signPaytrail } = await modulePromise;
  const headers = [['checkout-nonce', 'abc'], ['content-type', 'application/json'], ['checkout-account', '375917']];
  const body = '{"amount":15000}';
  const expectedSignature = createHmac('sha256', secret)
    .update(`checkout-account:375917\ncheckout-nonce:abc\n${body}`).digest('hex');
  assert.equal(await signPaytrail(secret, headers, body), expectedSignature);
  assert.notEqual(await signPaytrail(secret, headers, '{ "amount":15000}'), expectedSignature);
});

test('matches Paytrail’s published GET request signature', async () => {
  const { signPaytrail } = await modulePromise;
  const headers = Object.entries({
    'checkout-account': '375917',
    'checkout-algorithm': 'sha256',
    'checkout-method': 'GET',
    'checkout-timestamp': '2019-11-01T08:48:50.832Z',
    'checkout-transaction-id': '681538c4-fc84-11e9-83bc-2ffcef4c3453',
    'checkout-nonce': '87ac41e1-e6e6-4789-b8e0-c83930cfc447',
  });
  assert.equal(await signPaytrail(secret, headers), '4d84e3aedaa847b23e672ff3bc9c57ae5d1c1e84aec251ce39914eaf250bb8b2');
});

test('valid callbacks retain their distinct statuses and include future checkout fields', async () => {
  const { verifyPaytrailCallback } = await modulePromise;
  for (const status of ['ok', 'pending', 'delayed', 'fail']) {
    assert.deepEqual(await verifyPaytrailCallback(secret, callback(status), expected), { status });
  }
});

test('rejects tampered, duplicated, mismatched and unsupported callbacks', async () => {
  const { verifyPaytrailCallback } = await modulePromise;
  const tampered = callback();
  tampered.set('checkout-status', 'ok-modified');
  await assert.rejects(verifyPaytrailCallback(secret, tampered, expected), /signature/);
  const duplicate = callback();
  duplicate.append('checkout-amount', '15000');
  await assert.rejects(verifyPaytrailCallback(secret, duplicate, expected), /Duplicate/);
  const duplicateSignature = callback();
  duplicateSignature.append('signature', duplicateSignature.get('signature'));
  await assert.rejects(verifyPaytrailCallback(secret, duplicateSignature, expected), /signature/);
  await assert.rejects(verifyPaytrailCallback(secret, callback(), { ...expected, amount: '1' }), /match/);
  await assert.rejects(verifyPaytrailCallback(secret, callback('new'), expected), /status/);
  await assert.rejects(verifyPaytrailCallback('wrong-secret', callback(), expected), /signature/);
});

test('Paytrail client checks signed responses before returning payment details', async () => {
  const { getPaytrailPayment } = await import('../supabase/functions/_shared/paytrailClient.mjs');
  const originalFetch = globalThis.fetch;
  const body = JSON.stringify({ transactionId: '681538c4-fc84-11e9-83bc-2ffcef4c3453', status: 'ok' });
  let validSignature = true;
  let responseStatus = 200;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://services.paytrail.com/payments/681538c4-fc84-11e9-83bc-2ffcef4c3453');
    assert.equal(options.headers.get('checkout-account'), expected.account);
    assert.equal(options.headers.get('checkout-transaction-id'), '681538c4-fc84-11e9-83bc-2ffcef4c3453');
    const responseHeaders = new Headers({ 'checkout-account': expected.account });
    const signed = `checkout-account:${expected.account}\n${body}`;
    responseHeaders.set('signature', createHmac('sha256', validSignature ? secret : 'wrong').update(signed).digest('hex'));
    return new Response(body, { status: responseStatus, headers: responseHeaders });
  };
  try {
    assert.equal((await getPaytrailPayment({ account: expected.account, secret }, '681538c4-fc84-11e9-83bc-2ffcef4c3453')).status, 'ok');
    validSignature = false;
    await assert.rejects(getPaytrailPayment({ account: expected.account, secret }, '681538c4-fc84-11e9-83bc-2ffcef4c3453'), /response signature/);
    responseStatus = 500;
    await assert.rejects(getPaytrailPayment({ account: expected.account, secret }, '681538c4-fc84-11e9-83bc-2ffcef4c3453'), /response signature/);
    validSignature = true;
    await assert.rejects(getPaytrailPayment({ account: expected.account, secret }, '681538c4-fc84-11e9-83bc-2ffcef4c3453'), /HTTP 500/);
    await assert.rejects(getPaytrailPayment({ account: expected.account, secret }, '../bad'), /transaction ID/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('payment expiry uses an explicitly zoned Paytrail timestamp', async () => {
  const { parsePaytrailPaidAt } = await import('../supabase/functions/_shared/paytrailTime.mjs');
  assert.equal(parsePaytrailPaidAt('2026-01-01T10:00:00+02:00'), '2026-01-01T08:00:00.000Z');
  assert.equal(parsePaytrailPaidAt('2026-01-01T08:00:00Z'), '2026-01-01T08:00:00.000Z');
  assert.throws(() => parsePaytrailPaidAt('2019-10-30T09:14:28'), /timezone/);
  assert.throws(() => parsePaytrailPaidAt(undefined), /timezone/);
});
