const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function renderPromo(reduceMotion, eligible = true) {
  const animations = [];
  let value;
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useCallback: (callback) => callback,
    useRef: (current) => ({ current }),
  };
  class AnimatedValue {
    constructor(initial) { this.value = initial; value = this; }
    setValue(next) { this.value = next; }
  }
  const Animated = {
    Value: AnimatedValue,
    View: 'Animated.View',
    timing: (target, options) => ({ target, ...options }),
    sequence: (steps) => ({
      start: () => { animations.push(steps); },
      stop: () => {},
    }),
  };
  const native = {
    Animated,
    Easing: { out: (easing) => easing, cubic: 'cubic', quad: 'quad' },
    StyleSheet: { create: (styles) => styles },
    useWindowDimensions: () => ({ width: 400 }),
  };
  const dependencies = {
    react: { __esModule: true, default: React, ...React },
    'react-native': native,
    '@react-navigation/native': { useFocusEffect: (callback) => callback() },
    'react-native-safe-area-context': {},
    '@expo/vector-icons': {},
    'expo-linear-gradient': {},
    '../ThemeContext': {},
    '../theme': { fonts: {}, typography: {} },
    '../components/ScreenHeader': {},
    '../NotificationLabel': {},
    '../components/HomeSnow': {},
    '../components/HomeSnowContext': {},
    '../components/OuluWeatherBadge': {},
    '../FreeOrderUtils': {},
    '../SupabaseAPI': {},
    '../PackageAPI': { PACKAGE_PREVIEW_ENABLED: false },
    '../assets/image.png': {},
    '../assets/tractor-ground.png': {},
    '../assets/tractor-snowbank.png': {},
    '../assets/home-snowfield.png': {},
    '../assets/home-snow-mountain.png': {},
    '../assets/tractor-snowfall.png': {},
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'screens', 'HomeScreen.js'), 'utf8');
  const { code } = babel.transformSync(`${source}\nexport { AnimatedPromo };`, {
    filename: 'HomeScreen.js',
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {},
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(code, context);
  const element = context.exports.AnimatedPromo({
    order: () => {},
    eligible,
    reduceMotion,
    theme: { colors: {}, shadows: {} },
  });
  return { animations, value, element };
}

test('promo enters from the side, overshoots gently and settles', () => {
  const { animations, value } = renderPromo(false);
  assert.equal(value.value, -400);
  assert.equal(animations.length, 1);
  const [entrance, settle] = animations[0];
  assert.ok(entrance.toValue > 0 && entrance.toValue <= 10);
  assert.equal(settle.toValue, 0);
  assert.ok(entrance.useNativeDriver && settle.useNativeDriver);
});

test('reserves the promo space without exposing an unavailable offer', () => {
  for (const eligible of [null, false]) {
    const { element, animations } = renderPromo(false, eligible);
    assert.equal(element.props.style.opacity, 0);
    assert.equal(element.props.pointerEvents, 'none');
    assert.equal(element.props.accessibilityElementsHidden, true);
    assert.equal(element.props.importantForAccessibility, 'no-hide-descendants');
    assert.equal(animations.length, 0);
    assert.ok(element.children[0]);
  }
  const { element } = renderPromo(true);
  assert.equal(element.props.style.opacity, 1);
  assert.equal(element.props.pointerEvents, 'auto');
});

test('promo stays still when reduced motion is enabled or unknown', () => {
  for (const setting of [true, null]) {
    const { animations, element } = renderPromo(setting);
    assert.equal(animations.length, 0);
    assert.equal(element.props.style.opacity, setting === null ? 0 : 1);
    if (setting === true) assert.equal(element.props.style.transform[0].translateX, 0);
  }
});
