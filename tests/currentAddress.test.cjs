const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function loadLocation(overrides = {}, os = 'ios', timers = {}) {
  const calls = [];
  const location = {
    Accuracy: { High: 'high' },
    requestForegroundPermissionsAsync: async () => ({ granted: true }),
    hasServicesEnabledAsync: async () => true,
    getLastKnownPositionAsync: async () => null,
    getCurrentPositionAsync: async () => ({ coords: { latitude: 65.01, longitude: 25.47 } }),
    reverseGeocodeAsync: async () => [{ street: 'Testitie', streetNumber: '1', postalCode: '90100', city: 'Oulu' }],
    ...overrides,
  };
  for (const name of ['requestForegroundPermissionsAsync', 'hasServicesEnabledAsync', 'getLastKnownPositionAsync', 'getCurrentPositionAsync', 'reverseGeocodeAsync']) {
    const fn = location[name];
    location[name] = (...args) => { calls.push({ name, args }); return fn(...args); };
  }
  const source = fs.readFileSync(path.join(__dirname, '../utils/currentAddress.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {},
    require: (name) => {
      if (name === 'react-native') return { Platform: { OS: os } };
      if (name === 'expo-location') return location;
      throw new Error(`Unexpected dependency: ${name}`);
    },
    setTimeout: timers.setTimeout || setTimeout,
    clearTimeout: timers.clearTimeout || clearTimeout,
  };
  vm.runInNewContext(code, context);
  return { ...context.exports, calls };
}

test('requests foreground permission and returns a complete address and current coordinates', async () => {
  const { getCurrentAddress, calls } = loadLocation();
  const result = await getCurrentAddress();
  assert.equal(result.address, 'Testitie 1, 90100 Oulu');
  assert.equal(result.coordinates.latitude, 65.01);
  assert.equal(result.coordinates.longitude, 25.47);
  assert.deepEqual(calls.map((call) => call.name), [
    'requestForegroundPermissionsAsync', 'hasServicesEnabledAsync', 'getLastKnownPositionAsync', 'getCurrentPositionAsync', 'reverseGeocodeAsync',
  ]);
  assert.equal(calls[2].args[0].maxAge, 60000);
  assert.equal(calls[2].args[0].requiredAccuracy, 50);
  assert.equal(calls[3].args[0].accuracy, 'high');
});

test('uses a recent accurate cached position without waiting for a new GPS fix', async () => {
  const cached = { coords: { latitude: 65.02, longitude: 25.48, accuracy: 10 }, timestamp: Date.now() };
  const location = loadLocation({ getLastKnownPositionAsync: async () => cached });
  const result = await location.getCurrentAddress();
  assert.equal(result.coordinates.latitude, 65.02);
  assert.ok(!location.calls.some((call) => call.name === 'getCurrentPositionAsync'));
});

test('does not use a stale or imprecise cached position', async () => {
  for (const cached of [
    { coords: { latitude: 65.02, longitude: 25.48, accuracy: 10 }, timestamp: Date.now() - 120000 },
    { coords: { latitude: 65.02, longitude: 25.48, accuracy: 500 }, timestamp: Date.now() },
    { coords: { latitude: 65.02, longitude: 25.48, accuracy: null }, timestamp: Date.now() },
  ]) {
    const location = loadLocation({ getLastKnownPositionAsync: async () => cached });
    const result = await location.getCurrentAddress();
    assert.equal(result.coordinates.latitude, 65.01);
    assert.ok(location.calls.some((call) => call.name === 'getCurrentPositionAsync'));
  }
});

test('handles permission denial and unavailable location services before obtaining coordinates', async () => {
  const denied = loadLocation({ requestForegroundPermissionsAsync: async () => ({ granted: false }) });
  await assert.rejects(denied.getCurrentAddress(), /Salli sijainnin käyttö/);
  assert.deepEqual(denied.calls.map((call) => call.name), ['requestForegroundPermissionsAsync']);

  const disabled = loadLocation({ hasServicesEnabledAsync: async () => false });
  await assert.rejects(disabled.getCurrentAddress(), /sijaintipalvelut/);
  assert.deepEqual(disabled.calls.map((call) => call.name), ['requestForegroundPermissionsAsync', 'hasServicesEnabledAsync']);
});

test('rejects incomplete or missing addresses rather than choosing an unreliable delivery address', async () => {
  for (const result of [[], [{ street: 'Testitie', city: 'Oulu' }], [{ street: 'Testitie', streetNumber: '1' }]]) {
    const location = loadLocation({ reverseGeocodeAsync: async () => result });
    await assert.rejects(location.getCurrentAddress(), /Tarkkaa katuosoitetta ei löytynyt/);
  }
});

test('times out a stalled location lookup and reports unsupported web lookup', async () => {
  const stalled = loadLocation({ getCurrentPositionAsync: () => new Promise(() => {}) }, 'ios', {
    setTimeout: (callback, delay) => { if (delay === 15000) queueMicrotask(callback); return 1; },
    clearTimeout: () => {},
  });
  await assert.rejects(stalled.getCurrentAddress(), /kesti liian kauan/);
  assert.ok(stalled.calls.some((call) => call.name === 'getCurrentPositionAsync'));
  const web = loadLocation({}, 'web');
  await assert.rejects(web.getCurrentAddress(), /mobiilisovelluksessa/);
  assert.equal(web.calls.length, 0);
});

test('also times out stalled permission and location services requests', async () => {
  for (const [method, delay] of [['requestForegroundPermissionsAsync', 30000], ['hasServicesEnabledAsync', 5000]]) {
    const stalled = loadLocation({ [method]: () => new Promise(() => {}) }, 'ios', {
      setTimeout: (callback, ms) => { if (ms === delay) queueMicrotask(callback); return 1; },
      clearTimeout: () => {},
    });
    await assert.rejects(stalled.getCurrentAddress(), /kesti liian kauan/);
    assert.ok(stalled.calls.some((call) => call.name === method));
    assert.ok(!stalled.calls.some((call) => call.name === 'getCurrentPositionAsync'));
  }
});

test('falls back to a fresh fix when the cached position is unavailable', async () => {
  const location = loadLocation({
    getLastKnownPositionAsync: () => new Promise(() => {}),
  }, 'ios', {
    setTimeout: (callback, ms) => { if (ms === 2000) queueMicrotask(callback); return 1; },
    clearTimeout: () => {},
  });
  const result = await location.getCurrentAddress();
  assert.equal(result.coordinates.latitude, 65.01);
  assert.ok(location.calls.some((call) => call.name === 'getCurrentPositionAsync'));
});

test('times out a stalled reverse-geocoding request', async () => {
  const location = loadLocation({
    reverseGeocodeAsync: () => new Promise(() => {}),
  }, 'ios', {
    setTimeout: (callback, ms) => { if (ms === 10000) queueMicrotask(callback); return 1; },
    clearTimeout: () => {},
  });
  await assert.rejects(location.getCurrentAddress(), /kesti liian kauan/);
  assert.ok(location.calls.some((call) => call.name === 'reverseGeocodeAsync'));
});

test('stops before accessing coordinates when a permission request becomes stale', async () => {
  let resolvePermission;
  const location = loadLocation({
    requestForegroundPermissionsAsync: () => new Promise((resolve) => { resolvePermission = resolve; }),
  });
  let current = true;
  const lookup = location.getCurrentAddress(() => current);
  current = false;
  resolvePermission({ granted: true });
  await assert.rejects(lookup, /cancelled/);
  assert.deepEqual(location.calls.map((call) => call.name), ['requestForegroundPermissionsAsync']);
});
