const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function renderNavigator(theme, activeRoute = 'Koti', mountain = null) {
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (initial) => [initial === null ? mountain : activeRoute, () => {}],
  };
  const dependencies = {
    react: { __esModule: true, default: React, useState: React.useState },
    '@react-navigation/native': { NavigationContainer: 'NavigationContainer', DarkTheme: { colors: {} }, DefaultTheme: { colors: {} } },
    '@react-navigation/bottom-tabs': { BottomTabBar: 'BottomTabBar', createBottomTabNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native': { View: 'View', Animated: { View: 'Animated.View' }, StyleSheet: { absoluteFill: 'absoluteFill' }, useWindowDimensions: () => ({ fontScale: 1 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    '../ThemeContext': { useTheme: () => ({ theme }) },
    '../components/HomeSnowContext': { HomeSnowContext: { Provider: 'SnowProvider' }, SNOW_BACKGROUND: '#D8DDE3' },
  };
  for (const name of ['../screens/HomeScreen', '../screens/OrderScreen', '../screens/OmatTiedotScreen', '../screens/ExtraScreen', '../components/WinterBackground']) {
    dependencies[name] = { __esModule: true, default: name };
  }
  const source = fs.readFileSync(path.join(__dirname, '..', 'Navigation/AppNavigator.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    filename: 'AppNavigator.js',
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
  return context.exports.default();
}

function getTabBar(theme, mountain = null) {
  const app = renderNavigator(theme, 'Koti', mountain);
  return app.children[1].children[0].type().children[0].props.tabBar;
}

function renderBackground(theme, props) {
  const React = { createElement: (type, elementProps, ...children) => ({ type, props: elementProps, children }) };
  const dependencies = {
    react: { __esModule: true, default: React },
    'react-native': { View: 'View', Image: 'Image', StyleSheet: { absoluteFill: 'absoluteFill', create: (styles) => styles } },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '../ThemeContext': { useTheme: () => ({ theme }) },
    '../assets/Mountains.jpg': {},
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'components/WinterBackground.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    filename: 'WinterBackground.js',
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
  return context.exports.default(props);
}

test('uses the theme-specific home overlays without changing the other tabs', () => {
  const theme = { mode: 'light', colors: { overlay: 'overlay', homeOverlay: 'homeOverlay', homeCenterOverlay: 'homeCenterOverlay' } };
  assert.equal(renderNavigator(theme).children[0].props.overlayColor, 'homeOverlay');
  assert.equal(renderNavigator(theme).children[0].props.centerOverlayColor, 'homeCenterOverlay');
  for (const route of ['Tilaus', 'Historia', 'Profiili']) {
    assert.equal(renderNavigator(theme, route).children[0].props.overlayColor, 'overlay');
    assert.equal(renderNavigator(theme, route).children[0].props.centerOverlayColor, undefined);
  }
});

test('uses a 20% center overlay for light mode and keeps dark mode darker throughout', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = { exports: {} };
  vm.runInNewContext(code, context);
  const { lightTheme, darkTheme } = context.exports;
  const opacity = (color) => Number(color.match(/,\s*([\d.]+)\)$/)[1]);
  assert.equal(lightTheme.colors.homeCenterOverlay, 'rgba(0, 0, 0, 0.20)');
  assert.equal(lightTheme.colors.homeOverlay, 'rgba(0, 0, 0, 0.350784)');
  for (const key of ['homeOverlay', 'homeCenterOverlay']) {
    assert.ok(opacity(darkTheme.colors[key]) > opacity(lightTheme.colors[key]));
    assert.equal(renderNavigator(darkTheme).children[0].props[key === 'homeOverlay' ? 'overlayColor' : 'centerOverlayColor'], darkTheme.colors[key]);
  }
});

test('fades from the original overlay at each edge to the requested center opacity', () => {
  const theme = { colors: { overlay: 'otherOverlay' } };
  const home = renderBackground(theme, { overlayColor: 'homeOverlay', centerOverlayColor: 'rgba(0, 0, 0, 0.20)' });
  const gradient = home.children[1];
  assert.equal(home.props.pointerEvents, 'none');
  assert.equal(gradient.type, 'LinearGradient');
  assert.deepEqual(Array.from(gradient.props.colors), ['homeOverlay', 'rgba(0, 0, 0, 0.20)', 'homeOverlay']);
  assert.deepEqual(Array.from(gradient.props.locations), [0, 0.5, 1]);
  const other = renderBackground(theme, { overlayColor: 'otherOverlay' }).children[1];
  assert.equal(other.type, 'View');
  assert.equal(other.props.style[1].backgroundColor, 'otherOverlay');
});

test('keeps the screen background continuous behind rounded navigation in both themes', () => {
  const light = getTabBar({ mode: 'light', colors: { glass: 'glass' } });
  const orderProps = { state: { routes: [{ name: 'Tilaus' }], index: 0 } };
  const orderBar = light(orderProps);
  assert.equal(orderBar.props.style.backgroundColor, 'transparent');
  assert.equal(orderBar.children[1].type, 'BottomTabBar');
  assert.equal(orderBar.children[1].props.state, orderProps.state);
  assert.equal(light({ state: { routes: [{ name: 'Koti' }], index: 0 } }).props.style.backgroundColor, 'transparent');
  const dark = getTabBar({ mode: 'dark', colors: { glass: 'glass' } });
  assert.equal(dark(orderProps).props.style.backgroundColor, 'transparent');
  assert.equal(dark({ state: { routes: [{ name: 'Koti' }], index: 0 } }).props.style.backgroundColor, 'transparent');
});

test('extends the home mountain behind navigation without intercepting touches', () => {
  const mountain = { interpolate: (options) => options };
  const tabBar = getTabBar({ mode: 'light', colors: {} }, mountain);
  const props = (name) => ({ state: { routes: [{ name }], index: 0 } });
  const home = tabBar(props('Koti'));
  const backdrop = home.children[0];
  assert.equal(backdrop.type, 'Animated.View');
  assert.equal(backdrop.props.pointerEvents, 'none');
  assert.equal(backdrop.props.importantForAccessibility, 'no-hide-descendants');
  assert.deepEqual(Array.from(backdrop.props.style[1].opacity.inputRange), [0, 0.001, 1]);
  assert.deepEqual(Array.from(backdrop.props.style[1].opacity.outputRange), [0, 1, 1]);
  assert.equal(tabBar(props('Tilaus')).children[0], false);
  assert.equal(getTabBar({ mode: 'light', colors: {} })(props('Koti')).children[0], null);
});
