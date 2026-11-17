const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function nodes(element) {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  return [element, ...(element.children || []).flatMap(nodes)];
}

function loadHistory(getOrdersByDevice, packageApi = { PACKAGE_PREVIEW_ENABLED: false }) {
  const state = [];
  const refs = [];
  const navigations = [];
  let stateIndex = 0;
  let refIndex = 0;
  let focus;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useCallback: (callback) => callback,
  };
  const theme = {
    colors: { accent: 'white', textPrimary: 'white', textLight: 'white', textSecondary: 'white', primary: 'blue', onPrimary: 'white' },
    typography: {}, spacing: {}, fonts: {},
  };
  const dependencies = {
    react: {
      __esModule: true, default: React,
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => { state[index] = value; }];
      },
      useRef: (initial) => {
        const index = refIndex++;
        if (!refs[index]) refs[index] = { current: initial };
        return refs[index];
      },
    },
    'react-native': {
      View: 'View', Text: 'Text', FlatList: 'FlatList', RefreshControl: 'RefreshControl',
      TouchableOpacity: 'Button', ActivityIndicator: 'ActivityIndicator',
      StyleSheet: { create: (styles) => styles },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@react-navigation/native': {
      useNavigation: () => ({ navigate: (...args) => navigations.push(args) }),
      useFocusEffect: (callback) => { focus = callback; },
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../components/ScreenHeader': { __esModule: true, default: 'Header', SCREEN_TOP_SPACING: 0, screenLayout: {} },
    '../FreeOrderUtils': { getDeviceId: async () => 'device' },
    '../SupabaseAPI': { getOrdersByDevice },
    '../PackageAPI': packageApi,
    '../components/OrderHistoryItem': { __esModule: true, default: 'OrderHistoryItem' },
    '../ThemeContext': { useTheme: () => ({ theme }) },
  };
  const source = fs.readFileSync(path.join(__dirname, '../screens/ExtraScreen.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, console: { error() {} },
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(code, context);
  return {
    navigations,
    focus: () => focus(),
    render: () => {
      stateIndex = 0;
      refIndex = 0;
      return context.exports.default();
    },
  };
}

function list(tree) {
  return nodes(tree).find((node) => node.type === 'FlatList');
}

function expand(element) {
  return typeof element.type === 'function' ? element.type(element.props) : element;
}

function button(tree, label) {
  return nodes(tree).find((node) => node.type === 'Button' &&
    nodes(node).some((child) => child.type === 'Text' && child.children.includes(label)));
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('history merges authenticated package orders, including from another device', async () => {
  const packageApi = {
    PACKAGE_PREVIEW_ENABLED: true,
    getPackageSession: async () => ({ user: { email_confirmed_at: 'yes' } }),
    getPackageOrders: async () => [
      { order_id: 1, remaining_after: 9, restored: false, created_at: '2026-01-01', status: 'odottaa', service_address: 'Testitie' },
      { order_id: 2, remaining_after: 8, restored: false, created_at: '2026-01-02', status: 'kuitattu', service_address: 'Testitie' },
    ],
  };
  const screen = loadHistory(async () => [{ id: 1, created_at: '2026-01-01' }], packageApi);
  screen.render();
  screen.focus();
  await settle();
  const orders = list(screen.render()).props.data;
  assert.equal(orders.length, 2);
  assert.equal(orders[0].id, 2);
  assert.equal(orders[0].package_remaining_after, 8);
  assert.equal(orders[1].package_remaining_after, 9);
});

test('history errors are not shown as empty and retry can reveal the order CTA', async () => {
  let calls = 0;
  const screen = loadHistory(async (device, options) => {
    assert.equal(device, 'device');
    assert.equal(options.throwOnError, true);
    if (++calls === 1) throw new Error('offline');
    return [];
  });
  screen.render();
  screen.focus();
  await settle();
  let empty = expand(list(screen.render()).props.ListEmptyComponent);
  assert.ok(nodes(empty).some((node) => node.type === 'Text' && node.children.includes('Tilauksia ei voitu ladata')));
  assert.ok(!button(empty, 'Tee ensimmäinen tilauksesi'));
  await button(empty, 'Yritä uudelleen').props.onPress();
  empty = expand(list(screen.render()).props.ListEmptyComponent);
  assert.ok(nodes(empty).some((node) => node.type === 'Text' && node.children.includes('Ei tilauksia')));
  button(empty, 'Tee ensimmäinen tilauksesi').props.onPress();
  assert.deepEqual(screen.navigations[0], ['Tilaus']);
});

test('refresh failure preserves existing orders and shows an error with retry', async () => {
  let calls = 0;
  const screen = loadHistory(async () => {
    if (++calls === 1) return [{ id: 1 }];
    throw new Error('offline');
  });
  screen.render();
  screen.focus();
  await settle();
  let tree = screen.render();
  await list(tree).props.refreshControl.props.onRefresh();
  tree = screen.render();
  const historyList = list(tree);
  assert.equal(historyList.props.data.length, 1);
  assert.ok(button(expand(historyList.props.ListHeaderComponent), 'Yritä uudelleen'));
});

test('order API can propagate history failures without changing existing callers', async () => {
  const failure = new Error('database unavailable');
  const query = {
    select() { return this; },
    eq() { return this; },
    async order() { return { data: null, error: failure }; },
  };
  const source = fs.readFileSync(path.join(__dirname, '../SupabaseAPI.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, process: { env: {} }, console: { error() {} },
    require: (name) => {
      if (name === '@supabase/supabase-js') return { createClient: () => ({ from: () => query }) };
      if (name === './utils/geocodeAddress') return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(code, context);
  const { getOrdersByDevice } = context.exports;
  assert.equal((await getOrdersByDevice('device')).length, 0);
  await assert.rejects(getOrdersByDevice('device', { throwOnError: true }), failure);
});
