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

function createHome(getUserProfile, hasClaimedFreeOrder = async () => false, snowing = false, forecast = null, development = false, setNavigationSnow = null, packageApi = { PACKAGE_PREVIEW_ENABLED: false }) {
  const state = [];
  const navigation = [];
  const effects = [];
  const mountain = { interpolate: (options) => options };
  let stateIndex = 0;
  let focusCallback;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useCallback: (callback) => callback,
  };
  const theme = { colors: {}, shadows: {} };
  const dependencies = {
    react: {
      __esModule: true, default: React, ...React,
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useEffect: (effect) => { effects.push(effect); },
      useContext: () => setNavigationSnow,
      useRef: (initial) => ({ current: initial }),
    },
    'react-native': {
      View: 'View', Text: 'Text', Image: 'Image', Animated: { View: 'Animated.View' }, ScrollView: 'ScrollView', TouchableOpacity: 'Button',
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      useWindowDimensions: () => ({ height: 800, width: 400 }),
    },
    '@react-navigation/native': {
      useFocusEffect: (callback) => { focusCallback = callback; },
      useNavigation: () => ({ navigate: (...args) => navigation.push(args) }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../ThemeContext': { useTheme: () => ({ theme }) },
    '../theme': { fonts: {}, typography: {} },
    '../components/ScreenHeader': { SCREEN_TOP_SPACING: 24 },
    '../NotificationLabel': { __esModule: true, default: 'Notification' },
    '../components/HomeSnow': { Snowfall: 'Snowfall', useHomeSnow: () => ({ snowing, mountain }) },
    '../components/HomeSnowContext': { HomeSnowContext: {} },
    '../components/OuluWeatherBadge': { __esModule: true, default: 'WeatherBadge', useOuluForecast: () => forecast },
    '../FreeOrderUtils': { getDeviceId: async () => 'test-device' },
    '../SupabaseAPI': { getUserProfile, hasClaimedFreeOrder },
    '../PackageAPI': packageApi,
    '../assets/image.png': {},
    '../assets/tractor-ground.png': {},
    '../assets/tractor-snowbank.png': {},
    '../assets/home-snowfield.png': {},
    '../assets/home-snow-mountain.png': { name: 'snow-mountain' },
    '../assets/tractor-snowfall.png': {},
  };
  const source = fs.readFileSync(path.join(__dirname, '../screens/HomeScreen.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, __DEV__: development, console: { error() {} },
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(code, context);
  const render = () => {
    stateIndex = 0;
    return context.exports.default();
  };
  const profileAction = () => nodes(render()).find((node) => node.props.title === 'Omat tiedot');
  render();
  return { state, navigation, profileAction, render, effects, mountain, focus: () => focusCallback() };
}

test('home shows verified customer package balance and opens the package screen', async () => {
  const packageApi = {
    PACKAGE_PREVIEW_ENABLED: true,
    getPackageSession: async () => ({ user: { email_confirmed_at: 'yes' } }),
    getPackages: async () => [{ remaining: 9, expires_at: '2099-01-01' }],
  };
  const home = createHome(async () => null, undefined, false, null, false, null, packageApi);
  home.focus();
  await settle();
  const tracker = nodes(home.render()).find(node => node.props.accessibilityLabel?.includes('9 kertaa jäljellä'));
  assert.ok(tracker);
  tracker.props.onPress();
  assert.equal(home.navigation[0][0], 'Tilaus');
  assert.equal(home.navigation[0][1].openPackage, true);
});

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

function measureTractor(home) {
  const hero = nodes(home.render()).find((node) => node.type?.name === 'TractorAndSnow');
  const rendered = hero.type(hero.props);
  const layout = (node, y, height) => node.props.onLayout({ nativeEvent: { layout: { y, height } } });
  layout(rendered, 100, 400);
  const artwork = rendered.children[2];
  layout(artwork, 70, 200);
  const tractor = artwork.children[0];
  layout(tractor, 0, 170);
  layout(tractor.children[0], 0, 160);
}

test('confines snowfall to the tractor artwork, away from the home buttons', () => {
  const forecast = { days: [{ snow: true }] };
  const home = createHome(async () => null, undefined, true, forecast);
  const tree = home.render();
  assert.equal(nodes(tree).some((node) => node.type === 'Snowfall'), false);
  const hero = nodes(tree).find((node) => node.type?.name === 'TractorAndSnow');
  const rendered = hero.type(hero.props);
  const artwork = rendered.children[2];
  assert.equal(artwork.children[1].type, 'Snowfall');
  assert.equal(hero.type({ ...hero.props, snowing: false }).children[2].children[1], false);
  assert.equal(rendered.children[1].children.find((child) => child?.type === 'WeatherBadge').props.forecast, forecast);
});

test('the mountain rises behind the home content and leaves controls interactive', () => {
  const home = createHome(async () => null);
  home.render().props.onLayout({ nativeEvent: { layout: { height: 800 } } });
  measureTractor(home);
  const children = home.render().children.filter(Boolean);
  assert.equal(children[0].type.name, 'SnowMountain');
  assert.equal(children[1].type, 'ScrollView');
  const mountain = children[0].type(children[0].props);
  assert.equal(mountain.props.pointerEvents, 'none');
  assert.equal(mountain.props.importantForAccessibility, 'no-hide-descendants');
  assert.equal(mountain.props.style[1].height, 704);
  assert.deepEqual(Array.from(mountain.props.style[1].transform[0].translateY.outputRange), [704, 160]);
  const sway = mountain.props.style[1].transform[1].translateX.outputRange;
  assert.ok(Math.min(...sway) < 0 && Math.max(...sway) > 0);
  assert.ok(mountain.props.style[0].left <= Math.min(...sway));
  assert.ok(mountain.props.style[0].right <= -Math.max(...sway));
  assert.equal(mountain.children[0].props.source.name, 'snow-mountain');
  assert.equal(mountain.children[0].props.style.height, '100%');
});

test('shares the mountain animation with navigation and clears it on unmount', () => {
  const values = [];
  const home = createHome(async () => null, undefined, false, null, false, (value) => values.push(value));
  home.render().props.onLayout({ nativeEvent: { layout: { height: 800 } } });
  measureTractor(home);
  home.render();
  const cleanup = home.effects[home.effects.length - 2]();
  assert.equal(values[0], home.mountain);
  cleanup();
  assert.equal(values[1], null);
});

test('caps the mountain at the wheels unless snow is forecast today', () => {
  for (const [forecast, expected] of [
    [null, 160],
    [{ days: [{ snowTimes: [] }, { snowTimes: [1] }] }, 160],
    [{ days: [{ snowTimes: [1] }] }, 0],
  ]) {
    const home = createHome(async () => null, undefined, false, forecast);
    home.render().props.onLayout({ nativeEvent: { layout: { height: 800 } } });
    const beforeLayout = home.render().children[0].props;
    if (!forecast?.days[0].snowTimes.length) assert.equal(beforeLayout.maxHeight, 0);
    measureTractor(home);
    const mountain = home.render().children[0];
    assert.equal(mountain.type(mountain.props).props.style[1].transform[0].translateY.outputRange[1], expected);
    if (expected !== 0) {
      home.render().children[1].props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } });
      const scrolled = home.render().children[0];
      assert.equal(scrolled.type(scrolled.props).props.style[1].transform[0].translateY.outputRange[1], 60);
    }
  }
});

test('does not place a permanent snowbank above the order button', () => {
  const home = createHome(async () => null);
  const tree = home.render();
  assert.equal(nodes(tree).some((node) => node.type?.name === 'SnowBank'), false);
  assert.ok(nodes(tree).some((node) => node.props.title === 'Tilaa Lumityö'));
});

test('only enables falling snow when the current Oulu forecast indicates snow', () => {
  for (const [forecast, expected] of [
    [null, false],
    [{ days: [] }, false],
    [{ days: [{ snow: false }, { snow: true }], snowLater: true }, false],
    [{ days: [{}] }, false],
    [{ days: [{ snow: true }] }, true],
  ]) {
    const home = createHome(async () => null, undefined, true, forecast);
    const hero = nodes(home.render()).find((node) => node.type?.name === 'TractorAndSnow');
    assert.equal(hero.props.snowing, expected);
  }
  const home = createHome(async () => null, undefined, false, { days: [{ snow: true }] });
  assert.equal(nodes(home.render()).find((node) => node.type?.name === 'TractorAndSnow').props.snowing, false);
});

test('does not show a snowfall preview button in development or release', () => {
  const forecast = { days: [{ snow: false }] };
  for (const development of [true, false]) {
    const home = createHome(async () => null, undefined, true, forecast, development);
    const hero = nodes(home.render()).find((node) => node.type?.name === 'TractorAndSnow');
    assert.equal(hero.props.snowing, false);
    assert.equal(hero.type(hero.props).children[1].children.some((child) => child?.type === 'Button'), false);
  }
});

test('overlays weather above the tractor without taking layout space', () => {
  const home = createHome(async () => null);
  const hero = nodes(home.render()).find((node) => node.type?.name === 'TractorAndSnow');
  const rendered = hero.type(hero.props);
  const weatherSpace = rendered.children[1];
  assert.ok(weatherSpace.children.some((child) => child?.type === 'WeatherBadge'));
  assert.equal(weatherSpace.children.filter(Boolean).length, 1);
  assert.equal(weatherSpace.props.style.position, 'absolute');
  assert.equal(weatherSpace.props.pointerEvents, 'box-none');
  assert.ok(weatherSpace.props.style.zIndex > 0);
  const artwork = rendered.children[2];
  assert.ok(nodes(artwork).some((node) => node.props.accessibilityLabel === 'Lumityötä tekevä traktori'));
});

test('gently prompts for missing required details and keeps the profile button accessible', async () => {
  for (const profile of [null, { name: 'Testi', address: ' ', phone: '0400' }]) {
    const home = createHome(async (deviceId, options) => {
      assert.equal(deviceId, 'test-device');
      assert.equal(options.throwOnError, true);
      return profile;
    });
    assert.equal(home.profileAction().props.subtitle, 'Päivitä yhteystiedot');
    home.focus();
    await settle();
    const action = home.profileAction();
    assert.equal(action.props.subtitle, 'Täydennä yhteystietosi');
    const button = action.type(action.props);
    assert.match(button.props.accessibilityLabel, /Täydennä yhteystietosi/);
    button.props.onPress();
    assert.equal(home.navigation[0][0], 'Profiili');
  }
});

test('removes the prompt after profile details are saved and the homepage regains focus', async () => {
  let profile = null;
  const home = createHome(async () => profile);
  const blur = home.focus();
  await settle();
  assert.equal(home.profileAction().props.subtitle, 'Täydennä yhteystietosi');
  blur();
  profile = { name: 'Testi', address: 'Testitie 1', phone: '0400' };
  home.focus();
  await settle();
  assert.equal(home.profileAction().props.subtitle, 'Päivitä yhteystiedot');
});

test('a failed or stale profile lookup does not falsely prompt or affect the free-order banner', async () => {
  const failed = createHome(async () => { throw new Error('offline'); });
  failed.focus();
  await settle();
  assert.equal(failed.profileAction().props.subtitle, 'Päivitä yhteystiedot');
  assert.equal(failed.state[0], true);

  let resolveFirst;
  let calls = 0;
  const home = createHome(() => {
    calls += 1;
    return calls === 1
      ? new Promise((resolve) => { resolveFirst = resolve; })
      : Promise.resolve({ name: 'Testi', address: 'Testitie 1', phone: '0400' });
  });
  const blur = home.focus();
  await settle();
  blur();
  home.focus();
  await settle();
  resolveFirst(null);
  await settle();
  assert.equal(home.profileAction().props.subtitle, 'Päivitä yhteystiedot');
});
