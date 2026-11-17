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

function createAutocomplete() {
  const state = [];
  const refs = [];
  const timers = [];
  let stateIndex = 0;
  let refIndex = 0;
  let value = '';
  let locationCalls = 0;
  let cancelCalls = 0;
  let isLocating = false;
  let selectedAddress;
  let resolveFetch;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  };
  const theme = { colors: {}, fonts: {}, typography: {}, borderRadius: {} };
  const dependencies = {
    react: {
      __esModule: true, default: React,
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (next) => { state[index] = next; }];
      },
      useRef: (initial) => {
        const index = refIndex++;
        if (!refs[index]) refs[index] = { current: initial };
        return refs[index];
      },
      useEffect: () => {},
    },
    'react-native': {
      View: 'View', TextInput: 'TextInput', Text: 'Text', TouchableOpacity: 'Button',
      StyleSheet: { create: (styles) => styles }, ActivityIndicator: 'ActivityIndicator',
      Modal: 'Modal', Alert: {}, ScrollView: 'ScrollView', Keyboard: { dismiss() {} },
    },
    '../ThemeContext': { useTheme: () => ({ theme }) },
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: { mapboxAccessToken: 'test-token' } } } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
  };
  const source = fs.readFileSync(path.join(__dirname, '../components/AddressAutocompleteMapboxNew.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, process: { env: {} }, console: { log() {}, warn() {}, error() {} },
    fetch: () => new Promise((resolve) => { resolveFetch = resolve; }),
    setTimeout: (callback) => { const timer = { callback, cancelled: false }; timers.push(timer); return timer; },
    clearTimeout: (timer) => { if (timer) timer.cancelled = true; },
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(code, context);
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return context.exports.default({
      value,
      onChangeText: (next) => { value = next; },
      onAddressSelect: (next) => { selectedAddress = next; },
      onUseCurrentLocation: () => { locationCalls += 1; },
      onCancelCurrentLocation: () => { cancelCalls += 1; },
      isLocating,
    });
  };

  return {
    state, timers, render,
    get value() { return value; },
    get selectedAddress() { return selectedAddress; },
    get locationCalls() { return locationCalls; },
    get cancelCalls() { return cancelCalls; },
    setLocating: (next) => { isLocating = next; },
    resolveFetch: (response) => resolveFetch(response),
  };
}

test('location tap closes suggestions and prevents an in-flight search from reopening them', async () => {
  const autocomplete = createAutocomplete();
  const { state, timers, render } = autocomplete;
  nodes(render()).find((node) => node.type === 'TextInput').props.onChangeText('Testitie');
  const search = timers.find((timer) => !timer.cancelled).callback();
  const locationButton = nodes(render()).find((node) => node.type === 'Button' && node.props.accessibilityRole === 'button');
  locationButton.props.onPress();
  autocomplete.resolveFetch({
    status: 200,
    json: async () => ({ features: [{
      id: 'test', text: 'Testitie', place_name: 'Testitie, Oulu, Finland',
      center: [25.47, 65.01], context: [],
    }] }),
  });
  await search;

  assert.equal(autocomplete.locationCalls, 1);
  assert.equal(state[0].length, 0);
  assert.equal(state[1], false);
  assert.equal(state[2], false);
  autocomplete.setLocating(true);
  const cancel = nodes(render()).find((node) => node.type === 'Button' && node.props.accessibilityRole === 'button');
  assert.equal(cancel.props.disabled, false);
  assert.ok(nodes(cancel).some((node) => node.children?.includes('Peruuta sijainnin haku')));
  cancel.props.onPress();
  assert.equal(autocomplete.cancelCalls, 1);
  assert.equal(autocomplete.locationCalls, 1);

  autocomplete.setLocating(false);
  nodes(render()).find((node) => node.type === 'TextInput').props.onChangeText('Uusi katu');
  const secondSearch = timers.at(-1).callback();
  nodes(render()).find((node) => node.type === 'TextInput').props.onBlur({});
  timers.at(-1).callback();
  autocomplete.resolveFetch({ status: 200, json: async () => ({ features: [] }) });
  await secondSearch;
  assert.equal(state[2], false);
});

test('suggestions appear in the form flow and can be selected with the keyboard open', async () => {
  const autocomplete = createAutocomplete();
  const { timers, render } = autocomplete;
  nodes(render()).find((node) => node.type === 'TextInput').props.onChangeText('Testitie 12');
  const search = timers.at(-1).callback();
  autocomplete.resolveFetch({
    status: 200,
    json: async () => ({ features: [{
      id: 'test', text: 'Testitie', place_name: 'Testitie 12, Oulu, Finland',
      center: [25.47, 65.01], context: [],
    }] }),
  });
  await search;

  const tree = render();
  const list = nodes(tree).find((node) => node.type === 'ScrollView');
  assert.equal(list.props.keyboardShouldPersistTaps, 'always');
  const container = tree.children[1];
  assert.notEqual(container.props.style.position, 'absolute');
  assert.ok(nodes(container).some((node) => node.children?.includes('Osoite-ehdotukset')));
  const suggestion = nodes(container).find((node) => node.type === 'Button');
  assert.equal(suggestion.props.accessibilityLabel, 'Valitse osoite Testitie 12, Oulu');
  assert.equal(nodes(suggestion).find((node) => node.type === 'Text').props.numberOfLines, undefined);
  suggestion.props.onPress();
  assert.equal(autocomplete.value, 'Testitie 12, Oulu');
  assert.equal(autocomplete.selectedAddress.geometry.lat, 65.01);
  assert.equal(autocomplete.selectedAddress.geometry.lng, 25.47);
  assert.equal(autocomplete.state[2], false);
});

test('address search filters non-Finnish results and prioritizes Oulu and Kempele', async () => {
  const autocomplete = createAutocomplete();
  const { timers, render } = autocomplete;
  nodes(render()).find((node) => node.type === 'TextInput').props.onChangeText('Testitie');
  const search = timers.at(-1).callback();
  autocomplete.resolveFetch({
    status: 200,
    json: async () => ({ features: [
      { id: 'helsinki', text: 'Testitie', place_name: 'Testitie, Helsinki, Finland', center: [24.9, 60.2], context: [] },
      { id: 'stockholm', text: 'Testitie', place_name: 'Testitie, Stockholm, Sweden', center: [18.1, 59.3], context: [] },
      { id: 'oulu', text: 'Testitie', place_name: 'Testitie, Oulu, Finland', center: [25.47, 65.01], context: [] },
    ] }),
  });
  await search;

  assert.deepEqual(Array.from(autocomplete.state[0], (suggestion) => suggestion.id), ['oulu', 'helsinki']);
  assert.equal(autocomplete.state[2], true);
});
