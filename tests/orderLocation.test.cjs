const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function nodes(element) {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  return [element, ...(element.children || []).flatMap(nodes)];
}

function loadScreen(getCurrentAddress, platform = 'ios', getOrderSettings = async () => ({ continuous_order: false }), currentTheme, api = {}, packageApi = { PACKAGE_PREVIEW_ENABLED: false }) {
  const state = [false, 'Testi', '0400000000', 'Vanha osoite', null, 'Lumityö', '', null, false, 1, false];
  const refs = [];
  const alerts = [];
  const keyboardListeners = {};
  const measurements = new Map();
  const effects = [];
  let stateIndex = 0;
  let refIndex = 0;
  let focusIndex = 0;
  let effectIndex = 0;
  let focusCleanup;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useCallback: (callback) => callback,
    Fragment: 'Fragment',
  };
  const theme = currentTheme || {
    colors: { border: 'border', primary: 'primary' },
    fonts: {}, typography: {}, spacing: {}, shadows: {},
  };
  class CurrentAddressError extends Error {}
  const dependencies = {
    react: {
      __esModule: true, default: React,
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useRef: (initial) => {
        const index = refIndex++;
        if (!refs[index]) refs[index] = { current: initial };
        return refs[index];
      },
      useEffect: (callback, deps) => {
        const index = effectIndex++;
        if (deps.length === 0 && !effects[index]) effects[index] = callback() || true;
      },
    },
    'react-native': {
      ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
      Keyboard: {
        dismiss() {},
        addListener: (name, callback) => {
          keyboardListeners[name] = callback;
          return { remove: () => { delete keyboardListeners[name]; } };
        },
      },
      UIManager: {
        measureLayout: (target, _content, onFailure, onSuccess) => {
          const measurement = measurements.get(target);
          if (measurement) onSuccess(0, measurement.y, 100, measurement.height);
          else onFailure();
        },
      },
      View: 'View', Text: 'Text',
      TextInput: 'TextInput', TouchableOpacity: 'Button', Alert: { alert: (...args) => alerts.push(args) },
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      Platform: { OS: platform, select: (values) => values[platform] },
      KeyboardAvoidingView: 'KeyboardAvoidingView',
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@react-navigation/native': {
      useNavigation: () => ({}),
      useFocusEffect: (callback) => {
        if (focusIndex++ === 1 && !focusCleanup) focusCleanup = callback();
      },
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../theme': { createCardStyle: () => ({}) },
    '../ThemeContext': { useTheme: () => ({ theme }) },
    '../components/ScreenHeader': { __esModule: true, default: 'Header', SCREEN_TOP_SPACING: 0, screenLayout: {} },
    '../components/EdgeBackGesture': 'EdgeBackGesture',
    '../components/IconBackButton': { __esModule: true, default: 'Button' },
    '../FreeOrderUtils': { getDeviceId: async () => 'test-device' },
    '../SupabaseAPI': { getOrderSettings, ...api },
    '../components/AddressAutocompleteMapboxNew': { __esModule: true, default: 'Autocomplete' },
    '../styles': { __esModule: true, default: () => ({}) },
    '../utils/currentAddress': { getCurrentAddress, CurrentAddressError },
    '../PackageAPI': packageApi,
    './PackageScreen': {},
  };
  const keyboardSource = fs.readFileSync(path.join(__dirname, '../utils/keyboardScroll.js'), 'utf8');
  const keyboardCode = babel.transformSync(keyboardSource, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const keyboardContext = { exports: {}, console, require: () => dependencies['react-native'] };
  vm.runInNewContext(keyboardCode, keyboardContext);
  dependencies['../utils/keyboardScroll'] = keyboardContext.exports;
  const source = fs.readFileSync(path.join(__dirname, '../screens/OrderScreen.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, clearTimeout, setTimeout, console: { log() {}, error() {}, warn() {} },
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(code, context);
  return {
    state, alerts, measurements,
    emitKeyboard: (name) => keyboardListeners[name](),
    render: () => {
      stateIndex = 0;
      refIndex = 0;
      focusIndex = 0;
      effectIndex = 0;
      return context.exports.default({});
    },
    blur: () => focusCleanup(),
  };
}

test('package offer appears on the service-selection view', () => {
  const screen = loadScreen(() => {}, 'ios', undefined, undefined, {}, { PACKAGE_PREVIEW_ENABLED: true });
  screen.state[9] = 0;
  const offer = nodes(screen.render()).find(node => node.props.accessibilityLabel?.startsWith('Lumityöpaketti.'));
  assert.ok(offer);
  assert.ok(nodes(offer).some(node => node.type === 'Text' && node.children.includes('150 €')));
  assert.ok(nodes(offer).some(node => node.type === 'Text' && node.children.includes('10 lumityökertaa')));
  offer.props.onPress();
  assert.equal(screen.state[15], true);
});

test('using a package creates a prepaid order rather than a regular billed order', async () => {
  const calls = [];
  const item = { id: 'package-1', remaining: 7, expires_at: '2099-01-01', service_address: 'Vanha osoite' };
  const packageApi = {
    PACKAGE_PREVIEW_ENABLED: true,
    submitPackageOrder: async (user, payload) => { calls.push({ user, payload }); return 123; },
    getPackageSession: async () => ({ user: { id: 'customer', email_confirmed_at: 'yes' } }),
    getPackages: async () => [item],
  };
  const api = {
    getUserProfile: async () => null,
    upsertUserProfile: async () => ({ success: true, profile: {} }),
    hasClaimedFreeOrder: async () => true,
    createSnowOrder: async () => { throw new Error('ordinary order must not be used'); },
  };
  const screen = loadScreen(() => {}, 'ios', undefined, undefined, api, packageApi);
  screen.state[16] = { user: { id: 'customer' } };
  screen.state[17] = [item];
  const tree = screen.render();
  const option = nodes(tree).find(node => node.props.accessibilityRole === 'checkbox');
  assert.ok(option);
  option.props.onPress();
  screen.state[9] = 2;
  const confirm = nodes(screen.render()).find(node => node.type === 'Button' &&
    nodes(node).some(child => child.children?.includes('Vahvista tilaus')));
  await confirm.props.onPress();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].user, 'customer');
  assert.equal(calls[0].payload.p_purchase_id, 'package-1');
  assert.equal(calls[0].payload.p_device_id, 'test-device');
  assert.ok(screen.state[14]);
});

test('a package cannot be spent at a different address or before the free order', async () => {
  let submissions = 0;
  const packageApi = { PACKAGE_PREVIEW_ENABLED: true, submitPackageOrder: async () => { submissions++; } };
  const api = { hasClaimedFreeOrder: async () => false };
  const screen = loadScreen(() => {}, 'ios', undefined, undefined, api, packageApi);
  screen.state[16] = { user: { id: 'customer' } };
  screen.state[17] = [{ id: 'p', remaining: 10, expires_at: '2099-01-01', service_address: 'Vanha osoite' }];
  screen.state[19] = true;
  screen.state[9] = 2;
  const confirm = () => nodes(screen.render()).find(node => node.type === 'Button' &&
    nodes(node).some(child => child.children?.includes('Vahvista tilaus'))).props.onPress();
  screen.state[3] = 'Toinen osoite';
  await confirm();
  screen.state[3] = 'Vanha osoite';
  await confirm();
  assert.equal(submissions, 0);
  assert.equal(screen.alerts.length, 2);
});

test('identifies required fields and clears each error when corrected', () => {
  const screen = loadScreen(() => {});
  screen.state[1] = ' ';
  screen.state[2] = '';
  screen.state[3] = '';
  const findButton = (tree, label) => nodes(tree).find((node) =>
    node.type === 'Button' && nodes(node).some((child) => child.children?.includes(label)));
  findButton(screen.render(), 'Jatka').props.onPress();
  let tree = screen.render();
  for (const message of ['Anna osoite.', 'Anna puhelinnumero.', 'Anna nimi.']) {
    assert.ok(nodes(tree).some((node) => node.type === 'Text' && node.children.includes(message)));
    assert.match(screen.alerts[0][1], new RegExp(message));
  }
  const address = nodes(tree).find((node) => node.type === 'Autocomplete');
  assert.equal(address.props.inputStyle[1].borderColor, '#B42318');
  address.props.onChangeText('Lumitie 1');
  tree = screen.render();
  assert.ok(!nodes(tree).some((node) => node.type === 'Text' && node.children.includes('Anna osoite.')));
  const phone = nodes(tree).find((node) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Puhelinnumero');
  phone.props.onChangeText('0401234567');
  tree = screen.render();
  const name = nodes(tree).find((node) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Nimi');
  name.props.onChangeText('Maija');
  tree = screen.render();
  assert.ok(!nodes(tree).some((node) => node.type === 'Text' && node.children.includes('Anna puhelinnumero.')));
  assert.ok(!nodes(tree).some((node) => node.type === 'Text' && node.children.includes('Anna nimi.')));
  findButton(tree, 'Jatka').props.onPress();
  assert.equal(screen.state[9], 2);
});

test('shows saved order confirmation only after successful submission and prevents duplicate taps', async () => {
  const pending = deferred();
  let submissions = 0;
  const screen = loadScreen(() => {}, 'ios', undefined, undefined, {
    getUserProfile: async () => null,
    upsertUserProfile: async (_id, profile) => ({ success: true, profile }),
    createSnowOrder: async () => { submissions += 1; return pending.promise; },
    hasClaimedFreeOrder: async () => true,
    getOrdersByDevice: async () => [{ palvelu: 'Lumityö' }],
  });
  screen.state[9] = 2;
  const confirm = nodes(screen.render()).find((node) =>
    node.type === 'Button' && nodes(node).some((child) => child.children?.includes('Vahvista tilaus')));
  const first = confirm.props.onPress();
  const second = confirm.props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(submissions, 1);
  assert.ok(!nodes(screen.render()).some((node) => node.type === 'Text' && node.children.includes('Tilauksesi on vastaanotettu')));
  pending.resolve({ success: true, order: { id: 123 } });
  await Promise.all([first, second]);
  const tree = screen.render();
  assert.ok(nodes(tree).some((node) => node.type === 'Text' && node.children.includes('Tilauksesi on vastaanotettu')));
  assert.ok(nodes(tree).some((node) => node.type === 'Text' && node.children.includes('Lumityö')));
  assert.ok(nodes(tree).some((node) => node.type === 'Text' && node.children.includes('Vanha osoite')));
  assert.ok(!nodes(tree).some((node) => node.type === 'Button' && nodes(node).some((child) => child.children?.includes('Vahvista tilaus'))));
  const done = nodes(tree).find((node) => node.type === 'Button' && nodes(node).some((child) => child.children?.includes('Valmis')));
  await done.props.onPress();
  assert.equal(screen.state[9], 0);
  assert.equal(screen.state[5], null);
  assert.equal(screen.alerts.at(-1)[0], 'Hei! Kiinnostaako jatkuva tilaus?');
});

test('does not show a success screen when order creation fails', async () => {
  const screen = loadScreen(() => {}, 'ios', undefined, undefined, {
    getUserProfile: async () => null,
    upsertUserProfile: async (_id, profile) => ({ success: true, profile }),
    createSnowOrder: async () => ({ success: false, error: 'network error' }),
  });
  screen.state[9] = 2;
  const confirm = nodes(screen.render()).find((node) =>
    node.type === 'Button' && nodes(node).some((child) => child.children?.includes('Vahvista tilaus')));
  await confirm.props.onPress();
  assert.match(screen.alerts.at(-1)[1], /Tarkista tilaushistoria/);
  assert.ok(!nodes(screen.render()).some((node) => node.type === 'Text' && node.children.includes('Tilauksesi on vastaanotettu')));
});

test('order inputs share the light-theme input surface without changing dark mode', () => {
  const themeSource = fs.readFileSync(path.join(__dirname, '../theme.js'), 'utf8');
  const { code } = babel.transformSync(themeSource, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const themeContext = { exports: {} };
  vm.runInNewContext(code, themeContext);
  for (const currentTheme of [themeContext.exports.lightTheme, themeContext.exports.darkTheme]) {
    const tree = loadScreen(() => {}, 'ios', undefined, currentTheme).render();
    const address = nodes(tree).find((node) => node.type === 'Autocomplete');
    const inputs = nodes(tree).filter((node) => node.type === 'TextInput');
    const background = currentTheme.mode === 'light' ? currentTheme.colors.input : currentTheme.colors.orderSurface;
    assert.equal(address.props.inputStyle.backgroundColor, background);
    for (const input of inputs) {
      const inputStyle = Object.assign({}, ...[input.props.style].flat(Infinity).filter(Boolean));
      assert.equal(inputStyle.backgroundColor, background);
      assert.equal(inputStyle.color, currentTheme.colors.controlText);
      assert.equal(input.props.placeholderTextColor, currentTheme.colors.inputPlaceholder);
    }
  }
});

test('keeps the focused order field visible when the keyboard reduces the viewport', () => {
  for (const platform of ['ios', 'android']) {
    const screen = loadScreen(() => {}, platform);
    let tree = screen.render();
    const scroll = nodes(tree).find((node) => node.type === 'ScrollView');
    const info = nodes(scroll).find((node) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Lisätiedot');
    const calls = [];
    scroll.props.ref.current = {
      getInnerViewNode: () => 99,
      scrollTo: (options) => calls.push(options),
    };
    screen.measurements.set(42, { y: 650, height: 64 });
    scroll.props.onLayout({ nativeEvent: { layout: { height: 420 } } });
    info.props.onFocus({ nativeEvent: { target: 42 } });
    assert.equal(calls.at(-1).y, 306);

    scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 306 } } });
    scroll.props.onLayout({ nativeEvent: { layout: { height: 170 } } });
    assert.equal(calls.at(-1).y, 556);
    scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 556 } } });
    const count = calls.length;
    screen.emitKeyboard('keyboardDidShow');
    assert.equal(calls.length, count);
    tree = screen.render();
    const footer = nodes(tree).find((node) => Array.isArray(node.props.style) && node.props.style[0]?.paddingBottom === 12);
    assert.equal(footer.props.style[1].paddingBottom, 10);
    assert.ok(nodes(footer).some((node) => node.type === 'Button' && nodes(node).some((child) => child.children?.includes('Jatka'))));

    screen.measurements.set(42, { y: 1200, height: 64 });
    scroll.props.onLayout({ nativeEvent: { layout: { height: 170 } } });
    assert.equal(calls.at(-1).y, 1106);
    info.props.onBlur({ nativeEvent: { target: 42 } });
    const afterBlur = calls.length;
    scroll.props.onLayout({ nativeEvent: { layout: { height: 300 } } });
    assert.equal(calls.length, afterBlur);
    screen.emitKeyboard('keyboardDidHide');
    tree = screen.render();
    assert.equal(nodes(tree).find((node) => Array.isArray(node.props.style) && node.props.style[0]?.paddingBottom === 12).props.style[1], false);
  }
});

test('order footer preserves the continuous screen background in both themes', () => {
  for (const mode of ['light', 'dark']) {
    const theme = { mode, colors: { glass: `${mode}-glass` }, fonts: {}, typography: {}, spacing: {}, shadows: {} };
    const tree = loadScreen(() => {}, 'ios', undefined, theme).render();
    const footer = nodes(tree).find((node) =>
      node.type === 'View' && node.props.style?.backgroundColor === 'transparent' &&
      nodes(node).some((child) => child.type === 'Text' && child.children.includes('Jatka'))
    );
    assert.ok(footer);
    assert.equal(footer.props.style.width, '100%');
  }
});

test('location selection fills the address and preserves coordinates without showing a map', async () => {
  const screen = loadScreen(async () => ({
    address: 'Testitie 1, Oulu', coordinates: { latitude: 65.01, longitude: 25.47 },
  }));
  await nodes(screen.render()).find((node) => node.type === 'Autocomplete').props.onUseCurrentLocation();
  const tree = screen.render();
  assert.equal(nodes(tree).find((node) => node.type === 'Autocomplete').props.value, 'Testitie 1, Oulu');
  assert.equal(screen.state[4].latitude, 65.01);
  assert.equal(screen.state[4].longitude, 25.47);
  assert.match(screen.alerts[0][1], /Tarkista löydetty osoite/);
  assert.ok(!nodes(tree).some((node) => node.type === 'MapPreview' || node.children?.includes('Näytä kartta')));
});

test('address selection preserves coordinates and editing clears them', () => {
  const screen = loadScreen(() => {});
  const field = nodes(screen.render()).find((node) => node.type === 'Autocomplete');
  field.props.onAddressSelect({ geometry: { lat: 65.01, lng: 25.47 } });
  assert.equal(screen.state[4].latitude, 65.01);
  assert.equal(screen.state[4].longitude, 25.47);
  field.props.onChangeText('Uusi osoite');
  assert.equal(screen.state[4], null);
});

test('cancelling location lookup stops its loading state and ignores the eventual result', async () => {
  const pending = deferred();
  const screen = loadScreen(() => pending.promise);
  const field = nodes(screen.render()).find((node) => node.type === 'Autocomplete');
  const lookup = field.props.onUseCurrentLocation();
  const busyField = nodes(screen.render()).find((node) => node.type === 'Autocomplete');
  assert.equal(busyField.props.isLocating, true);
  busyField.props.onCancelCurrentLocation();
  assert.equal(nodes(screen.render()).find((node) => node.type === 'Autocomplete').props.isLocating, false);
  pending.resolve({ address: 'Väärä osoite', coordinates: { latitude: 65, longitude: 25 } });
  await lookup;
  assert.equal(screen.state[3], 'Vanha osoite');
  assert.equal(screen.alerts.length, 0);
});

test('editing the address or leaving the screen prevents a pending lookup from overwriting it', async () => {
  for (const action of ['edit', 'blur']) {
    const pending = deferred();
    const screen = loadScreen(() => pending.promise);
    const field = nodes(screen.render()).find((node) => node.type === 'Autocomplete');
    const lookup = field.props.onUseCurrentLocation();
    if (action === 'edit') field.props.onChangeText('Uusi osoite');
    else screen.blur();
    pending.resolve({ address: 'Väärä osoite', coordinates: { latitude: 65, longitude: 25 } });
    await lookup;
    assert.equal(screen.state[3], action === 'edit' ? 'Uusi osoite' : 'Vanha osoite');
    assert.equal(screen.state[4], null);
    assert.equal(screen.alerts.length, 0);
  }
});

test('failed lookup preserves the entered address and shows an error', async () => {
  const screen = loadScreen(async () => { throw new Error('device error'); });
  const field = nodes(screen.render()).find((node) => node.type === 'Autocomplete');
  await field.props.onUseCurrentLocation();
  assert.equal(screen.state[3], 'Vanha osoite');
  assert.match(screen.alerts[0][1], /syötä osoite käsin/);
});

test('renders two progress connectors with completed segments at every step', () => {
  const screen = loadScreen(() => {});
  for (let step = 0; step < 3; step += 1) {
    screen.state[9] = step;
    const progress = nodes(screen.render()).find((node) => node.props.accessibilityRole === 'progressbar');
    const lines = progress.children[0].children[0];
    assert.equal(lines.length, 2);
    assert.equal(lines.filter((line) => line.props.style[1]).length, step);
    assert.equal(progress.props.accessibilityValue.now, step + 1);
  }
});

test('completed steps use the blue selected surface and contrasting checkmarks in both themes', () => {
  const source = fs.readFileSync(path.join(__dirname, '../theme.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = { exports: {} };
  vm.runInNewContext(code, context);
  for (const theme of [context.exports.lightTheme, context.exports.darkTheme]) {
    const screen = loadScreen(() => {}, 'ios', undefined, theme);
    screen.state[9] = 2;
    const progress = nodes(screen.render()).find((node) => node.props.accessibilityRole === 'progressbar');
    const steps = progress.children[1];
    for (const step of steps.slice(0, 2)) {
      const marker = step.children[0];
      const style = Object.assign({}, ...marker.props.style.filter(Boolean));
      assert.equal(style.backgroundColor, theme.colors.primary);
      assert.equal(style.borderColor, theme.colors.primary);
      assert.equal(marker.children[0].props.name, 'checkmark');
      assert.equal(marker.children[0].props.color, theme.colors.onPrimary);
    }
  }
});

test('progress connectors meet the edge-aligned step markers', () => {
  const progress = nodes(loadScreen(() => {}).render()).find((node) => node.props.accessibilityRole === 'progressbar');
  const lines = progress.children[0].props.style;
  const steps = progress.children[1];
  const stepStyle = (step) => Object.assign({}, ...step.props.style.filter(Boolean));
  const markerWidth = steps[0].children[0].props.style[0].width;
  assert.equal(stepStyle(steps[0]).alignItems, 'flex-start');
  assert.equal(stepStyle(steps[1]).alignItems, 'center');
  assert.equal(stepStyle(steps[2]).alignItems, 'flex-end');
  assert.equal(lines.left, markerWidth / 2);
  assert.equal(lines.right, markerWidth / 2);
});

test('shows step labels and highlights the current step throughout the order flow', () => {
  const screen = loadScreen(() => {});
  const labels = ['Valitse palvelu', 'Yhteystiedot', 'Vahvista tilaus'];
  for (let step = 0; step < labels.length; step += 1) {
    screen.state[9] = step;
    const progress = nodes(screen.render()).find((node) => node.props.accessibilityRole === 'progressbar');
    assert.equal(progress.props.accessibilityLabel, labels[step]);
    const stepLabels = nodes(progress).filter((node) => node.type === 'Text' && labels.includes(node.children[0]));
    assert.deepEqual(stepLabels.map((node) => node.children[0]), labels);
    stepLabels.forEach((node, index) => assert.equal(Boolean(node.props.style[1]), index === step));
  }
});

test('selecting a service leads directly to contact details on iOS and Android', async () => {
  for (const platform of ['ios', 'android']) {
    const screen = loadScreen(() => {}, platform);
    screen.state[5] = null;
    screen.state[9] = 0;
    let tree = screen.render();
    const scroll = nodes(tree).find((node) => node.type === 'ScrollView');
    assert.notEqual(scroll.props.scrollEnabled, false);
    const cards = nodes(scroll).filter((node) => typeof node.type === 'function' && node.props.service);
    assert.equal(cards.length, 2);
    const button = cards[1].type(cards[1].props);
    assert.equal(button.props.accessibilityRole, 'button');
    const surface = Object.assign({}, ...button.props.style.filter(Boolean));
    const iconContainer = button.children[0];
    const iconStyle = iconContainer.props.style;
    const icon = iconContainer.children[0];
    const iconCenter = (surface.borderWidth || 0) + (surface.paddingLeft || 0) + (iconStyle.width - iconStyle.borderRightWidth) / 2;
    const divider = (surface.borderWidth || 0) + (surface.paddingLeft || 0) + iconStyle.width - iconStyle.borderRightWidth / 2;
    const leftSpace = iconCenter - icon.props.size / 2;
    const rightSpace = divider - iconCenter - icon.props.size / 2;
    assert.ok(leftSpace >= 20 && rightSpace >= 20);
    assert.ok(Math.abs(leftSpace - rightSpace) <= 2);
    assert.ok(!nodes(tree).some((node) =>
      node.type === 'Button' && nodes(node).some((child) => child.type === 'Text' && child.children.includes('Jatka'))
    ));
    await button.props.onPress();
    assert.equal(screen.state[5], 'Polanteen poisto');
    assert.equal(screen.state[9], 1);
    tree = screen.render();
    assert.ok(nodes(tree).some((node) => node.type === 'Autocomplete'));
    const back = nodes(tree).find((node) => node.type === 'Button' && node.props.accessibilityLabel === 'Takaisin');
    back.props.onPress();
    assert.equal(screen.state[9], 0);
    const selectedCard = nodes(screen.render()).find((node) => node.props.service === 'Polanteen poisto');
    assert.equal(selectedCard.props.isSelected, true);
  }
});

test('continuous order warning prevents advancing when snow work is selected', async () => {
  const screen = loadScreen(() => {}, 'ios', async () => ({ continuous_order: true }));
  screen.state[5] = null;
  screen.state[9] = 0;
  const card = nodes(screen.render()).find((node) => node.props.service === 'Lumityö');
  await card.props.onPress('Lumityö');
  assert.equal(screen.state[9], 0);
  assert.equal(screen.state[5], null);
  assert.equal(screen.alerts[0][0], 'Jatkuva tilaus aktiivinen');
});

test('a pending service selection cannot advance after leaving the screen', async () => {
  const pending = deferred();
  const screen = loadScreen(() => {}, 'ios', () => pending.promise);
  screen.state[5] = null;
  screen.state[9] = 0;
  const card = nodes(screen.render()).find((node) => node.props.service === 'Lumityö');
  const selection = card.props.onPress('Lumityö');
  await Promise.resolve();
  screen.blur();
  pending.resolve({ continuous_order: false });
  await selection;
  assert.equal(screen.state[9], 0);
  assert.equal(screen.state[5], null);
});

test('a pending selection disables other services until the check finishes', async () => {
  const pending = deferred();
  const screen = loadScreen(() => {}, 'ios', () => pending.promise);
  screen.state[5] = null;
  screen.state[9] = 0;
  const first = nodes(screen.render()).find((node) => node.props.service === 'Lumityö');
  const selection = first.props.onPress('Lumityö');
  const second = nodes(screen.render()).find((node) => node.props.service === 'Polanteen poisto');
  assert.equal(second.type(second.props).props.disabled, true);
  await second.props.onPress('Polanteen poisto');
  pending.resolve({ continuous_order: false });
  await selection;
  assert.equal(screen.state[5], 'Lumityö');
  assert.equal(screen.state[9], 1);
});
