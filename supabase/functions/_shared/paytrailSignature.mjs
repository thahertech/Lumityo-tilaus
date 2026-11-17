const encoder = new TextEncoder();

function payload(entries, body) {
  const fields = new Map();
  for (const [rawName, value] of entries) {
    const name = rawName.toLowerCase();
    if (!name.startsWith('checkout-')) continue;
    if (fields.has(name)) throw new Error(`Duplicate Paytrail field: ${name}`);
    if (typeof value !== 'string' || /[\r\n]/.test(value)) {
      throw new Error(`Invalid Paytrail field: ${name}`);
    }
    fields.set(name, value);
  }
  return [...fields.entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, value]) => `${name}:${value}`)
    .concat(body)
    .join('\n');
}

async function keyFor(secret) {
  if (typeof secret !== 'string' || !secret) throw new Error('Paytrail secret is required');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signPaytrail(secret, entries, body = '') {
  if (typeof body !== 'string') throw new TypeError('Paytrail body must be the exact serialized string');
  const key = await keyFor(secret);
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload(entries, body)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPaytrailMessage(secret, entries, body, signature) {
  if (typeof body !== 'string') throw new TypeError('Paytrail body must be the exact serialized string');
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const signedPayload = payload(entries, body);
  const bytes = Uint8Array.from(signature.match(/../g), (part) => parseInt(part, 16));
  const key = await keyFor(secret);
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(signedPayload));
}

export async function verifyPaytrailCallback(secret, searchParams, expected) {
  if (!(searchParams instanceof URLSearchParams)) throw new TypeError('Expected URLSearchParams');
  if (!expected || !['account', 'stamp', 'transactionId', 'amount'].every((name) =>
    typeof expected[name] === 'string' && expected[name].length > 0)) {
    throw new Error('Expected payment details are required');
  }
  if (searchParams.getAll('signature').length !== 1) throw new Error('Invalid Paytrail signature');
  const signature = searchParams.get('signature');
  if (!/^[0-9a-f]{64}$/i.test(signature)) throw new Error('Invalid Paytrail signature');

  const valid = await verifyPaytrailMessage(secret, searchParams.entries(), '', signature);
  if (!valid) throw new Error('Invalid Paytrail signature');

  const fields = Object.fromEntries([...searchParams.entries()].map(([name, value]) => [name.toLowerCase(), value]));
  if (fields['checkout-algorithm'] !== 'sha256' ||
      fields['checkout-account'] !== expected.account ||
      fields['checkout-stamp'] !== expected.stamp ||
      fields['checkout-transaction-id'] !== expected.transactionId ||
      fields['checkout-amount'] !== expected.amount) {
    throw new Error('Paytrail payment details do not match');
  }
  const status = fields['checkout-status'];
  if (!['ok', 'fail', 'pending', 'delayed'].includes(status)) {
    throw new Error('Unexpected Paytrail payment status');
  }
  return { status };
}
