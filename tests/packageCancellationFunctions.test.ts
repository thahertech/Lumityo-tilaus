const handlers: Array<(request: Request) => Promise<Response>> = [];
const originalServe = Deno.serve;
// Capture the registered handlers without binding network ports.
Deno.serve = ((handler: (request: Request) => Promise<Response>) => {
  handlers.push(handler);
  return {} as Deno.HttpServer;
}) as typeof Deno.serve;
await import('../supabase/functions/package-cancellation/index.ts');
await import('../supabase/functions/package-cancellation-worker/index.ts');
Deno.serve = originalServe;

const settings: Record<string, string> = {
  PACKAGE_CANCELLATIONS_ENABLED: 'true',
  PACKAGE_CANCELLATION_DELIVERY_ENABLED: 'true',
  SUPABASE_URL: 'https://example.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  CANCELLATION_EMAILJS_SERVICE_ID: 'test-service',
  CANCELLATION_EMAILJS_TEMPLATE_ID: 'test-template',
  CANCELLATION_EMAILJS_PUBLIC_KEY: 'test-public-key',
  CANCELLATION_EMAILJS_PRIVATE_KEY: 'test-private-key',
  CANCELLATION_SUPPORT_EMAIL: 'support@example.invalid',
  CANCELLATION_WORKER_SECRET: 'test-worker-secret-32-characters-long',
};
for (const [key, value] of Object.entries(settings)) Deno.env.set(key, value);

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

Deno.test('request records and returns the server timestamp, without requiring login', async () => {
  const originalFetch = globalThis.fetch;
  let recorded: Record<string, string> | undefined;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    assert(url.includes('/rest/v1/rpc/record_package_cancellation'), 'unexpected network request');
    recorded = JSON.parse(String(init?.body));
    return Response.json('2026-11-14T20:00:00Z');
  };
  try {
    const response = await handlers[0](new Request('https://local.invalid', {
      method: 'POST',
      body: JSON.stringify({
        id: '10000000-0000-0000-0000-000000000001', name: 'Test',
        email: 'test@example.invalid', contract: 'Lumityöpaketti',
      }),
    }));
    assert(response.status === 200, 'request was not accepted');
    assert((await response.json()).receivedAt === '2026-11-14T20:00:00Z', 'missing receipt timestamp');
    assert(recorded?.p_contract === 'Lumityöpaketti', 'contract details were not recorded');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('worker delivers customer and support messages independently', async () => {
  const originalFetch = globalThis.fetch;
  const item: Record<string, string> = {
    id: '10000000-0000-0000-0000-000000000001', customer_name: 'Test',
    customer_email: 'test@example.invalid', contract_details: 'Lumityöpaketti',
    received_at: '2026-11-14T20:00:00Z', customer_delivery: 'pending', support_delivery: 'pending',
  };
  const deliveries: Array<Record<string, string>> = [];
  let rejectDelivery = false;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith('https://api.emailjs.com/')) {
      deliveries.push(JSON.parse(String(init?.body)).template_params);
      return rejectDelivery ? new Response('Rejected', { status: 500 }) : new Response('OK');
    }
    assert(url.startsWith('https://example.invalid/rest/v1/package_cancellation_requests'), 'unexpected network request');
    if (init?.method === 'PATCH') Object.assign(item, JSON.parse(String(init.body)));
    return Response.json(init?.method === 'PATCH' ? { id: item.id } : item);
  };
  const callWorker = () => handlers[1](new Request('https://local.invalid', {
    method: 'POST', headers: { authorization: `Bearer ${settings.CANCELLATION_WORKER_SECRET}` },
  }));
  try {
    assert((await callWorker()).status === 204, 'customer email failed');
    assert((await callWorker()).status === 204, 'support email failed');
    assert(deliveries[0].to_email === 'test@example.invalid', 'confirmation recipient is wrong');
    assert(deliveries[1].to_email === 'support@example.invalid', 'support recipient is wrong');
    assert(deliveries[0].message.includes('Lumityöpaketti') && deliveries[0].message.includes('Vastaanotettu:'),
      'confirmation must include contract and time');
    assert(item.customer_delivery === 'sent' && item.support_delivery === 'sent', 'delivery states were not recorded');
    item.customer_delivery = 'pending';
    item.support_delivery = 'pending';
    rejectDelivery = true;
    assert((await callWorker()).status === 503, 'provider failure must be surfaced');
    assert(item.customer_delivery === 'needs_review', 'failed delivery requires manual review');
    rejectDelivery = false;
    assert((await callWorker()).status === 204, 'support delivery must proceed independently');
    assert(item.support_delivery === 'sent', 'support delivery was not recorded after customer failure');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
