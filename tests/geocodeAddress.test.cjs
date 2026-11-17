const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

const root = path.join(__dirname, '..');

function loadModule(filename, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  const { code } = babel.transformSync(source, {
    filename,
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {},
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    process: { env: {} },
    console: { log() {}, warn() {}, error() {} },
    AbortController,
    setTimeout,
    clearTimeout,
    ...globals,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

function makeGeocoder(fetch, extra, globals = {}) {
  return loadModule('utils/geocodeAddress.js', {
    'expo-constants': { expoConfig: { extra } },
  }, { fetch, ...globals }).geocodeAddress;
}

test('geocodes saved address with Mapbox before using the fallback', async () => {
  const requests = [];
  const geocode = makeGeocoder(async (url) => {
    requests.push(url);
    return { ok: true, json: async () => ({ features: [{ center: [25.47, 65.01] }] }) };
  }, { mapboxAccessToken: 'test-mapbox', opencageApiKey: 'test-opencage' });
  const result = await geocode('Testikatu 1, Oulu');
  assert.equal(result.lat, 65.01);
  assert.equal(result.lon, 25.47);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^https:\/\/api\.mapbox\.com\//);
});

test('falls back to OpenCage for missing or invalid Mapbox coordinates', async () => {
  const requests = [];
  const geocode = makeGeocoder(async (url) => {
    requests.push(url);
    return {
      ok: true,
      json: async () => url.includes('mapbox.com')
        ? { features: [{ center: [999, 65] }] }
        : { status: { code: 200 }, results: [{ geometry: { lat: 65.02, lng: 25.48 } }] },
    };
  }, { mapboxAccessToken: 'test-mapbox', opencageApiKey: 'test-opencage' });
  const result = await geocode('Testikatu 1, Oulu');
  assert.equal(result.lat, 65.02);
  assert.equal(result.lon, 25.48);
  assert.equal(requests.length, 2);
});

test('returns without coordinates when a provider times out and no fallback is configured', async () => {
  let aborted = false;
  const geocode = makeGeocoder((url, { signal }) => {
    signal.addEventListener('abort', () => { aborted = true; });
    return new Promise(() => {});
  }, { mapboxAccessToken: 'test-mapbox' }, {
    setTimeout: (callback) => { queueMicrotask(callback); return 1; },
    clearTimeout: () => {},
  });
  const result = await geocode('Testikatu 1, Oulu');
  assert.equal(result.lat, null);
  assert.equal(result.lon, null);
  assert.equal(aborted, true);
});

function makeOrderApi(geocodeAddress, capture) {
  const supabase = {
    from: () => ({
      insert: (data) => {
        capture.push(data);
        return { select: () => ({ single: async () => ({ data: { id: 1 }, error: null }) }) };
      },
    }),
  };
  return loadModule('SupabaseAPI.js', {
    '@supabase/supabase-js': { createClient: () => supabase },
    './utils/geocodeAddress': { geocodeAddress },
  }).createSnowOrder;
}

const order = { serviceType: 'Lumityö', address: 'Testikatu 1, Oulu', phone: '0400000000', name: 'Testi' };

test('profile lookup distinguishes a missing profile from an error when requested', async () => {
  let result = { data: null, error: { code: 'PGRST116' } };
  const supabase = { from: () => ({
    select: () => ({ eq: () => ({ single: async () => result }) }),
  }) };
  const { getUserProfile } = loadModule('SupabaseAPI.js', {
    '@supabase/supabase-js': { createClient: () => supabase },
    './utils/geocodeAddress': {},
  });
  assert.equal(await getUserProfile('device', { throwOnError: true }), null);
  result = { data: null, error: new Error('offline') };
  assert.equal(await getUserProfile('device'), null);
  await assert.rejects(getUserProfile('device', { throwOnError: true }), /offline/);
});

test('continuous-order lookup can report failures instead of treating them as disabled', async () => {
  let result = { data: [], error: null };
  const query = {
    select: () => query,
    eq: () => query,
    neq: () => query,
    limit: async () => result,
  };
  const { getOrderSettings } = loadModule('SupabaseAPI.js', {
    '@supabase/supabase-js': { createClient: () => ({ from: () => query }) },
    './utils/geocodeAddress': {},
  });
  assert.equal(await getOrderSettings('device', { throwOnError: true }), null);
  result = { data: [{ id: 1 }], error: null };
  assert.equal((await getOrderSettings('device', { throwOnError: true })).continuous_order, true);
  result = { data: null, error: new Error('offline') };
  assert.equal(await getOrderSettings('device'), null);
  await assert.rejects(getOrderSettings('device', { throwOnError: true }), /offline/);
});

test('profile updates persist empty contact fields without changing order records', async () => {
  const writes = [];
  const supabase = { from: (table) => ({
    upsert: (data) => {
      writes.push({ table, data });
      return { select: () => ({ single: async () => ({ data, error: null }) }) };
    },
  }) };
  const { upsertUserProfile } = loadModule('SupabaseAPI.js', {
    '@supabase/supabase-js': { createClient: () => supabase },
    './utils/geocodeAddress': {},
  });
  const result = await upsertUserProfile('device', { name: '', phone: '', address: '', email: '' });
  assert.equal(result.success, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, 'user_profiles');
  assert.equal(writes[0].data.name, '');
  assert.equal(writes[0].data.phone, '');
  assert.equal(writes[0].data.address, '');
  assert.equal(writes[0].data.email, null);
});

test('preserves selected or manually adjusted coordinates without geocoding', async () => {
  const saved = [];
  const createOrder = makeOrderApi(() => { throw new Error('must not geocode'); }, saved);
  const result = await createOrder('device', { ...order, coordinates: { latitude: 65.1, longitude: 25.2 } });
  assert.equal(result.success, true);
  assert.equal(saved[0].lat, 65.1);
  assert.equal(saved[0].lon, 25.2);
});

test('geocodes an autofilled address and submits even if geocoding fails', async () => {
  const saved = [];
  const createOrder = makeOrderApi(async () => ({ lat: 65.01, lon: 25.47 }), saved);
  assert.equal((await createOrder('device', order)).success, true);
  assert.equal(saved[0].lat, 65.01);
  assert.equal(saved[0].lon, 25.47);

  const failed = [];
  const createWithoutCoordinates = makeOrderApi(async () => { throw new Error('offline'); }, failed);
  assert.equal((await createWithoutCoordinates('device', order)).success, true);
  assert.equal(failed[0].lat, null);
  assert.equal(failed[0].lon, null);

  const noMatch = [];
  const createWithNoMatch = makeOrderApi(async () => ({ lat: null, lon: null }), noMatch);
  assert.equal((await createWithNoMatch('device', order)).success, true);
  assert.equal(noMatch[0].lat, null);
  assert.equal(noMatch[0].lon, null);
});
