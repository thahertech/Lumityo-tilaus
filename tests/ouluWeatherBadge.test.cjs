const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function createBadge(getOuluForecast, getOuluDateKey = () => '2026-01-15') {
  const state = [];
  let stateIndex = 0;
  let focus;
  let appState;
  let interval;
  let alert;
  let removed = false;
  const errors = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useCallback: (callback) => callback,
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    },
  };
  const dependencies = {
    react: { __esModule: true, default: React, ...React },
    'react-native': {
      View: 'View', Text: 'Text', TouchableOpacity: 'Button',
      Alert: { alert: (...args) => { alert = args; } },
      AppState: { addEventListener: (event, callback) => { appState = callback; return { remove: () => { removed = true; } }; } },
      Linking: { openURL: async () => {} }, StyleSheet: { create: (styles) => styles },
    },
    '@react-navigation/native': { useFocusEffect: (callback) => { focus = callback; } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../theme': { fonts: {} },
    '../ThemeContext': { useTheme: () => ({ theme: { colors: { homeSurface: 'promoSurface', border: 'promoBorder' } } }) },
    '../utils/ouluWeather': { getOuluForecast, getOuluDateKey },
  };
  const source = fs.readFileSync(path.join(__dirname, '../components/OuluWeatherBadge.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, console: { error: (...args) => errors.push(args) },
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    setInterval: (callback) => { interval = callback; return 1; }, clearInterval: () => {},
  };
  vm.runInNewContext(code, context);
  const render = () => {
    stateIndex = 0;
    return context.exports.default({ forecast: context.exports.useOuluForecast() });
  };
  render();
  return { render, focus: () => focus(), activate: () => appState('active'), background: () => appState('background'), tick: () => interval(), getAlert: () => alert, errors, removed: () => removed };
}

const forecast = {
  days: [
    { dateKey: '2026-01-15', date: Date.parse('2026-01-15T12:00:00Z'), temperature: -2, time: Date.parse('2026-01-15T10:00:00Z'), icon: 'cloud-outline', description: 'pilvistä', snowTimes: [Date.parse('2026-01-15T15:00:00Z')] },
    { dateKey: '2026-01-16', date: Date.parse('2026-01-16T12:00:00Z'), temperature: 1, time: Date.parse('2026-01-16T10:00:00Z'), icon: 'cloud-outline', description: 'pilvistä', snowTimes: [Date.parse('2026-01-16T18:00:00Z')] },
    { dateKey: '2026-01-17', date: Date.parse('2026-01-17T12:00:00Z'), temperature: null, time: null, snowTimes: [Date.parse('2026-01-17T08:00:00Z')] },
  ],
};
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('announces forecast, upcoming snow and attribution and opens details', async () => {
  const badge = createBadge(async () => forecast);
  assert.equal(badge.render(), null);
  const blur = badge.focus();
  await settle();
  const widget = badge.render();
  const buttons = widget.children[1].children[0];
  assert.equal(buttons.length, 3);
  const heading = widget.children[0].children[0];
  assert.equal(heading.children[0].children[0], 'Oulu · sääennuste');
  assert.equal(heading.props.style[1].backgroundColor, 'promoSurface');
  assert.equal(heading.props.style[1].borderColor, 'promoBorder');
  buttons[2].props.onLayout({ nativeEvent: { layout: { width: 120 } } });
  buttons[2].children[0].props.onLayout({ nativeEvent: { layout: { width: 70 } } });
  assert.equal(badge.render().children[0].children[0].props.style[1].marginRight, 25);
  for (const card of buttons) {
    assert.equal(card.props.style.backgroundColor, undefined);
    assert.equal(card.props.style.borderWidth, undefined);
    assert.equal(card.props.accessibilityRole, 'button');
  }
  const button = buttons[0];
  assert.equal(button.props.accessibilityRole, 'button');
  assert.match(button.props.accessibilityLabel, /Oulun sääennuste/);
  assert.match(button.props.accessibilityLabel, /Lumisadetta ennustetaan tunneille 17[.:]00/);
  assert.match(button.props.accessibilityLabel, /Ilmatieteen laitos.*CC BY 4.0/);
  assert.equal(button.children[1].children[0].props.name, 'cloud-outline');
  assert.equal(button.children[1].children[2].children[1].props.name, 'snow-outline');
  assert.match(buttons[1].props.accessibilityLabel, /Lumisadetta ennustetaan tunneille 20[.:]00/);
  assert.match(buttons[2].props.accessibilityLabel, /lämpötilaennustetta ei ole saatavilla/);
  assert.match(buttons[2].props.accessibilityLabel, /Lumisadetta ennustetaan tunneille 10[.:]00/);
  for (const card of buttons) assert.equal(card.children[1].children[2].children[1].props.name, 'snow-outline');
  button.props.onPress();
  assert.match(badge.getAlert()[1], /Ilmatieteen laitos/);
  assert.ok(badge.getAlert()[2].some((action) => action.text === 'Lisenssi'));
  blur();
  assert.equal(badge.removed(), true);
});

test('clears stale information on failure and refreshes on foreground', async () => {
  let calls = 0;
  const badge = createBadge(async () => {
    calls += 1;
    if (calls === 2) throw new Error('offline');
    return forecast;
  });
  badge.focus();
  await settle();
  assert.ok(badge.render());
  badge.activate();
  await settle();
  assert.equal(badge.render(), null);
  assert.equal(badge.errors.length, 1);
  badge.activate();
  await settle();
  assert.ok(badge.render());
  badge.background();
  assert.equal(badge.render(), null);
});

test('uses the main snow icon without duplicating it when the displayed hour is snowy', async () => {
  const snowy = {
    ...forecast,
    days: [{ ...forecast.days[0], icon: 'snow-outline', snow: true, description: 'lumisadetta' }, ...forecast.days.slice(1)],
  };
  const badge = createBadge(async () => snowy);
  badge.focus();
  await settle();
  const button = badge.render().children[1].children[0][0];
  assert.equal(button.children[1].children[0].props.name, 'snow-outline');
  assert.equal(button.children[1].children[2], false);
  assert.match(button.props.accessibilityLabel, /Lumisadetta ennustetaan tunneille/);
});

test('ignores a forecast response after the screen loses focus', async () => {
  let resolve;
  const badge = createBadge(() => new Promise((done) => { resolve = done; }));
  const blur = badge.focus();
  blur();
  resolve(forecast);
  await settle();
  assert.equal(badge.render(), null);
});

test('does not restore an in-flight forecast after the app backgrounds', async () => {
  let resolve;
  const badge = createBadge(() => new Promise((done) => { resolve = done; }));
  badge.focus();
  badge.background();
  resolve(forecast);
  await settle();
  assert.equal(badge.render(), null);
});

test('refreshes the widget when the Oulu calendar day changes', async () => {
  let day = '2026-01-15';
  let calls = 0;
  const badge = createBadge(async () => { calls += 1; return forecast; }, () => day);
  badge.focus();
  await settle();
  day = '2026-01-16';
  badge.tick();
  await settle();
  assert.equal(calls, 2);
});
