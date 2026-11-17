import { signPaytrail, verifyPaytrailMessage } from './paytrailSignature.mjs';

const BASE_URL = 'https://services.paytrail.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function request(config, method, path, body, transactionId) {
  if (!config || !/^\d+$/.test(config.account) || typeof config.secret !== 'string' || !config.secret) {
    throw new Error('Paytrail server configuration is incomplete');
  }
  const headers = new Headers({
    'checkout-account': config.account,
    'checkout-algorithm': 'sha256',
    'checkout-method': method,
    'checkout-nonce': crypto.randomUUID(),
    'checkout-timestamp': new Date().toISOString(),
    'platform-name': 'lumityot',
  });
  if (transactionId) headers.set('checkout-transaction-id', transactionId);
  const serialized = body === undefined ? '' : JSON.stringify(body);
  if (body !== undefined) headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('signature', await signPaytrail(config.secret, headers.entries(), serialized));

  const response = await fetch(BASE_URL + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: serialized }),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  const rawBody = await response.text();
  const verified = await verifyPaytrailMessage(config.secret, response.headers.entries(), rawBody, response.headers.get('signature'));
  if (!verified) throw new Error('Invalid Paytrail response signature');
  if (!response.ok) throw new Error(`Paytrail request failed (HTTP ${response.status})`);
  return JSON.parse(rawBody);
}

export async function createPaytrailPayment(config, payment) {
  return request(config, 'POST', '/payments', payment);
}

export async function getPaytrailPayment(config, transactionId) {
  if (typeof transactionId !== 'string' || !UUID.test(transactionId)) throw new Error('Invalid Paytrail transaction ID');
  return request(config, 'GET', `/payments/${transactionId}`, undefined, transactionId);
}
