const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function setup(enabled = true, releaseEnabled = false) {
  const saved = new Map();
  const calls = [];
  let nextId = 0;
  let invoke = async () => ({ data: { status: 'new', checkoutUrl: 'https://pay.paytrail.com/pay/test' }, error: null });
  let rpc = async () => ({ data: 42, error: null });
  let storageFails = false;
  const supabase = {
    auth: {},
    functions: { invoke: (...args) => { calls.push(args); return invoke(...args); } },
    rpc: (...args) => { calls.push(args); return rpc(...args); },
  };
  const modules = {
    'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => {}, currentState: 'background' } },
    '@supabase/supabase-js': { createClient: () => supabase },
    'expo-crypto': { randomUUID: () => `40000000-0000-0000-0000-${String(++nextId).padStart(12, '0')}` },
    'expo-secure-store': {
      getItemAsync: async (key) => saved.get(key) ?? null,
      setItemAsync: async (key, value) => {
        if (storageFails) throw new Error('Storage unavailable');
        saved.set(key, value);
      },
      deleteItemAsync: async (key) => saved.delete(key),
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'PackageAPI.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    filename: 'PackageAPI.js', configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, __DEV__: enabled, process: { env: {
      EXPO_PUBLIC_PACKAGE_PREVIEW: 'true', EXPO_PUBLIC_PACKAGE_ENABLED: releaseEnabled ? 'true' : 'false',
    } },
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
  };
  vm.runInNewContext(code, context);
  return {
    api: context.exports, saved, calls,
    setInvoke: (fn) => { invoke = fn; },
    setRpc: (fn) => { rpc = fn; },
    failStorage: () => { storageFails = true; },
  };
}

test('production builds cannot access packages without the explicit release flag', async () => {
  const { api, saved, calls } = setup(false);
  await assert.rejects(api.startOrResumeCheckout('user', 'Testikatu 1, Oulu', '123', 'test@example.invalid', 'device', 'v1'), /preview is disabled/);
  assert.equal(saved.size, 0);
  assert.equal(calls.length, 0);
});

test('the release flag allows the package client in production builds', async () => {
  const { api, calls } = setup(false, true);
  await api.startOrResumeCheckout('user', 'Testikatu 1, Oulu', '123', 'test@example.invalid', 'device', 'v1');
  assert.equal(calls.length, 1);
});

test('checkout retry keeps the original ID and address after an uncertain response', async () => {
  const { api, calls, setInvoke } = setup();
  setInvoke(async () => ({ error: new Error('Network failed') }));
  await assert.rejects(api.startOrResumeCheckout('user', 'Testikatu 1, Oulu', '123', 'test@example.invalid', 'device', 'v1'));
  const first = await api.getPendingCheckout('user');
  setInvoke(async () => ({ data: { status: 'paid' }, error: null }));
  await api.startOrResumeCheckout('user', 'Different address', '456', 'test@example.invalid', 'other-device', 'v2');
  assert.equal(calls[0][1].body.checkoutId, first.id);
  assert.equal(calls[1][1].body.checkoutId, first.id);
  assert.equal(calls[1][1].body.address, 'Testikatu 1, Oulu');
  assert.equal(calls[1][1].body.phone, '123');
  assert.equal(calls[1][1].body.deviceId, 'device');
  assert.equal(calls[1][1].body.termsVersion, 'v1');
  assert.equal(await api.getPendingCheckout('user'), null);
});

test('an uncertain order can only be retried with its original payload', async () => {
  const { api, calls, setRpc } = setup();
  const payload = {
    p_purchase_id: '20000000-0000-0000-0000-000000000001',
    p_device_id: 'device', p_name: 'Test', p_phone: '123', p_info: null,
  };
  setRpc(async () => ({ error: new Error('Network failed') }));
  await assert.rejects(api.submitPackageOrder('user', payload));
  const pending = await api.getPendingPackageOrder('user');
  await assert.rejects(api.submitPackageOrder('user', { ...payload, p_name: 'Changed' }), /different package order/);
  setRpc(async () => ({ data: 42, error: null }));
  assert.equal(await api.submitPackageOrder('user', pending.payload), 42);
  assert.equal(calls[0][1].p_request_id, calls[1][1].p_request_id);
  assert.equal(await api.getPendingPackageOrder('user'), null);
});

test('no payment request is sent when request storage or validation fails', async () => {
  const { api, calls, failStorage } = setup();
  await assert.rejects(api.startOrResumeCheckout('user', 'abc', '123', 'test@example.invalid', 'device', 'v1'), /Invalid checkout/);
  await assert.rejects(api.startOrResumeCheckout('user', 'Testikatu 1, Oulu', '  ', 'test@example.invalid', 'device', 'v1'), /Invalid checkout/);
  failStorage();
  await assert.rejects(api.startOrResumeCheckout('user', 'Testikatu 1, Oulu', '123', 'test@example.invalid', 'device', 'v1'), /Storage unavailable/);
  assert.equal(calls.length, 0);
});

test('an unresolved checkout is recovered after signing in on another device', async () => {
  const { api, setRpc, setInvoke, calls } = setup();
  setRpc(async (name) => {
    assert.equal(name, 'my_unresolved_package_checkout');
    return { data: [{
      id: '40000000-0000-0000-0000-000000000001',
      customer_email: 'test@example.invalid', service_address: 'Testikatu 1, Oulu', device_id: 'device', phone: '123', terms_version: 'v1', payment_status: 'pending',
    }], error: null };
  });
  const recovered = await api.recoverPendingCheckout('user');
  setInvoke(async () => ({ data: { status: 'pending' }, error: null }));
  await api.startOrResumeCheckout('user', 'Different address', '456', 'different@example.invalid', 'new-device', 'v2');
  assert.equal(calls[1][1].body.checkoutId, recovered.id);
  assert.equal(calls[1][1].body.address, 'Testikatu 1, Oulu');
  assert.equal(calls[1][1].body.deviceId, 'device');
  assert.equal(calls[1][1].body.phone, '123');
});

test('conflicting local and remote checkouts require review instead of starting another payment', async () => {
  const { api, setRpc, setInvoke } = setup();
  setInvoke(async () => ({ error: new Error('Network failed') }));
  await assert.rejects(api.startOrResumeCheckout('user', 'Testikatu 1, Oulu', '123', 'test@example.invalid', 'device', 'v1'));
  setRpc(async () => ({ data: [{
    id: '40000000-0000-0000-0000-000000000002',
    customer_email: 'test@example.invalid', service_address: 'Testikatu 2, Oulu', device_id: 'device', phone: '123', terms_version: 'v1', payment_status: 'new',
  }], error: null }));
  await assert.rejects(api.recoverPendingCheckout('user'), /Conflicting unresolved/);
  assert.equal((await api.getPendingCheckout('user')).payload.address, 'Testikatu 1, Oulu');
});

test('cancellation retries preserve the original request after an uncertain response', async () => {
  const { api, calls, setInvoke } = setup();
  const payload = { name: 'Test', email: 'test@example.invalid', contract: 'Lumityöpaketti, Testikatu 1' };
  setInvoke(async () => ({ error: new Error('Network failed') }));
  await assert.rejects(api.submitPackageCancellation(payload));
  const pending = await api.getPendingCancellation();
  await assert.rejects(api.submitPackageCancellation({ ...payload, contract: 'Another purchase' }), /different cancellation/);
  setInvoke(async () => ({ data: { receivedAt: '2026-11-14T20:00:00Z' }, error: null }));
  assert.equal(await api.submitPackageCancellation(payload), '2026-11-14T20:00:00Z');
  assert.equal(calls[0][1].body.id, pending.id);
  assert.equal(calls[1][1].body.id, pending.id);
  assert.equal(await api.getPendingCancellation(), null);
});

test('invalid or unpersisted cancellation details are not sent', async () => {
  const { api, calls, failStorage } = setup();
  await assert.rejects(api.submitPackageCancellation({ name: 'Test', email: 'bad', contract: 'Package' }), /Invalid cancellation/);
  failStorage();
  await assert.rejects(api.submitPackageCancellation({ name: 'Test', email: 'test@example.invalid', contract: 'Package' }), /Storage unavailable/);
  assert.equal(calls.length, 0);
});
