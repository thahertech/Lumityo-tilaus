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

test('cancellation requires confirmation and only reports receipt after successful submission', async () => {
  const state = [];
  let index = 0;
  let alert;
  let sent;
  const keyboard = { scrollViewRef: {}, onFocusInput() {}, onBlurInput() {}, onLayout() {}, onScroll() {} };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    Fragment: 'Fragment',
    useState: (initial) => {
      const current = index++;
      if (!(current in state)) state[current] = initial;
      return [state[current], (value) => { state[current] = value; }];
    },
    useRef: (initial) => ({ current: initial }),
    useEffect: () => {},
  };
  const dependencies = {
    react: { __esModule: true, default: React, ...React },
    'react-native': {
      Alert: { alert: (...args) => { alert = args; } }, KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' }, ScrollView: 'ScrollView',
      StyleSheet: { create: (styles) => styles }, Text: 'Text', TextInput: 'TextInput',
      TouchableOpacity: 'Button', View: 'View',
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../ThemeContext': { useTheme: () => ({ theme: { colors: {} } }) },
    '../components/ScreenHeader': { SCREEN_TOP_SPACING: 0, screenLayout: {} },
    '../components/EdgeBackGesture': 'EdgeBackGesture',
    '../components/IconBackButton': { __esModule: true, default: 'Button' },
    '../hooks/useKeyboardAwareScroll': { __esModule: true, default: () => keyboard },
    '../PackageAPI': {
      submitPackageCancellation: async (payload) => { sent = payload; return '2026-11-14T20:00:00Z'; },
      getPendingCancellation: async () => null,
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../screens/PackageCancellationScreen.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, console,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(code, context);
  const render = () => { index = 0; return nodes(context.exports.default({ onClose() {} })); };
  render();
  state[3] = false;
  let page = render();
  assert.equal(page.find((node) => node.type === 'KeyboardAvoidingView').props.behavior, 'padding');
  assert.equal(page.find((node) => node.type === 'TextInput').props.onFocus, keyboard.onFocusInput);
  dependencies['react-native'].Platform.OS = 'android';
  assert.equal(render().find((node) => node.type === 'KeyboardAvoidingView').props.behavior, 'height');
  dependencies['react-native'].Platform.OS = 'ios';
  const field = (label) => page.find((node) => node.props.accessibilityLabel === label);
  field('Nimi').props.onChangeText('Test');
  field('Sähköposti vahvistusta varten').props.onChangeText('test@example.invalid');
  field('Peruutettavan ostoksen tiedot').props.onChangeText('Lumityöpaketti');
  page = render();
  page.find((node) => node.type === 'Button' && nodes(node).some((child) => child.children?.includes('Jatka'))).props.onPress();
  assert.equal(sent, undefined);
  await alert[2].find((button) => button.text === 'Vahvista ja lähetä').onPress();
  assert.equal(sent.contract, 'Lumityöpaketti');
  page = render();
  assert.ok(page.some((node) => node.children.some((child) => typeof child === 'string' && child.includes('Ilmoituksesi on vastaanotettu'))));
});
