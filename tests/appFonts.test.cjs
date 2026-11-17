const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function renderApp(fontState) {
  const errors = [];
  let requestedFonts;
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useEffect: (effect) => effect(),
  };
  const dependencies = {
    react: { __esModule: true, default: React, useEffect: React.useEffect },
    'react-native': { ActivityIndicator: 'ActivityIndicator', View: 'View' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-font': { useFonts: (fonts) => { requestedFonts = fonts; return fontState; } },
    './Navigation/AppNavigator': { __esModule: true, default: 'AppNavigator' },
    './ThemeContext': { ThemeProvider: 'ThemeProvider' },
  };
  for (const name of ['400Regular', '400Regular_Italic', '500Medium']) {
    dependencies[`@expo-google-fonts/source-sans-3/${name}`] = { [`SourceSans3_${name}`]: name };
  }
  for (const name of ['600SemiBold', '700Bold']) {
    dependencies[`@expo-google-fonts/geist/${name}`] = { [`Geist_${name}`]: name };
  }
  const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    filename: 'App.js',
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
    console: { error: (...args) => errors.push(args) },
  };
  vm.runInNewContext(code, context);
  return { element: context.exports.default(), errors, getRequestedFonts: () => requestedFonts };
}

test('waits for the bundled fonts before rendering the app', () => {
  const pending = renderApp([false, null]);
  assert.equal(pending.element.type, 'View');
  assert.equal(pending.element.children[0].type, 'ActivityIndicator');
  assert.deepEqual(Object.keys(pending.getRequestedFonts()).sort(), [
    'Geist_600SemiBold', 'Geist_700Bold', 'SourceSans3_400Regular', 'SourceSans3_400Regular_Italic', 'SourceSans3_500Medium',
  ]);
  assert.equal(renderApp([true, null]).element.type, 'ThemeProvider');
});

test('reports font loading errors without blocking the app', () => {
  const error = new Error('font failed');
  const result = renderApp([false, error]);
  assert.equal(result.element.type, 'ThemeProvider');
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0][1], error);
});

test('uses loaded heading and body faces for their respective text roles', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    filename: 'theme.js',
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = { exports: {} };
  vm.runInNewContext(code, context);
  const { typography } = context.exports;
  const requested = renderApp([true, null]).getRequestedFonts();
  assert.match(typography.h2.fontFamily, /^Geist_/);
  assert.match(typography.button.fontFamily, /^Geist_/);
  assert.match(typography.body.fontFamily, /^SourceSans3_/);
  assert.match(typography.bodySmall.fontFamily, /^SourceSans3_/);
  for (const style of Object.values(typography)) {
    assert.ok(style.fontFamily in requested, `Font ${style.fontFamily} is not loaded`);
  }
});
