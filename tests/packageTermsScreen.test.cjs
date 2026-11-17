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

test('terms links open their content and return to the package page', () => {
  const state = [];
  let stateIndex = 0;
  const keyboard = { scrollViewRef: {}, keyboardVisible: false, onFocusInput() {}, onBlurInput() {}, onLayout() {}, onScroll() {} };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    Fragment: 'Fragment',
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    },
    useRef: (initial) => ({ current: initial }),
    useEffect: () => {},
  };
  const dependencies = {
    react: { __esModule: true, default: react, ...react },
    'react-native': {
      Alert: {}, KeyboardAvoidingView: 'KeyboardAvoidingView', Linking: {}, Platform: { OS: 'ios' }, ScrollView: 'ScrollView', StyleSheet: { create: (styles) => styles },
      Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'Button', View: 'View',
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../ThemeContext': { useTheme: () => ({ theme: { colors: {}, fonts: {} } }) },
    '../components/ScreenHeader': { SCREEN_TOP_SPACING: 0, screenLayout: {} },
    '../components/EdgeBackGesture': 'EdgeBackGesture',
    '../components/IconBackButton': { __esModule: true, default: 'Button' },
    '../FreeOrderUtils': {},
    '../SupabaseAPI': {},
    '../PackageAPI': {},
    './PackageCancellationScreen': { __esModule: true, default: 'CancellationScreen' },
    '../hooks/useKeyboardAwareScroll': { __esModule: true, default: () => keyboard },
  };
  const source = fs.readFileSync(path.join(__dirname, '../screens/PackageScreen.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
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
  const renderScreen = () => {
    stateIndex = 0;
    return context.exports.default({ onClose() {} });
  };
  const render = () => nodes(renderScreen());

  const screen = renderScreen();
  const footer = screen.children.find((child) =>
    child?.type === 'View' && nodes(child).some((node) => node.props.accessibilityRole === 'link'));
  assert.ok(footer, 'terms links remain at the bottom outside the scroll view');
  assert.equal(screen.children.indexOf(footer) > screen.children.findIndex((child) => child?.type === 'ScrollView'), true);
  assert.equal(screen.props.behavior, 'padding');
  keyboard.keyboardVisible = true;
  assert.equal(render().some((node) => node.props.accessibilityRole === 'link'), false);
  keyboard.keyboardVisible = false;
  const cancellation = nodes(footer).find((node) =>
    node.props.accessibilityRole === 'link' && nodes(node).some((child) => child.children?.includes('Peruuta ostos')));
  assert.ok(cancellation);
  cancellation.props.onPress();
  assert.equal(renderScreen().type, 'CancellationScreen');
  renderScreen().props.onClose();

  for (const title of ['Maksuehdot', 'Käyttöehdot']) {
    const link = render().find((node) =>
      node.props.accessibilityRole === 'link' && nodes(node).some((child) => child.children?.includes(title)));
    assert.ok(link, `${title} link is visible without signing in`);
    link.props.onPress();
    const termsScreen = renderScreen();
    const termsPage = nodes(termsScreen);
    assert.ok(termsPage.some((node) => node.props.accessibilityRole === 'header' && node.children.includes(title)));
    const scroll = termsScreen.children.find((child) => child?.type === 'ScrollView');
    const termsText = scroll.children.find((child) => child?.type === 'Text' && child.children.some((text) => typeof text === 'string' && /^(Palveluntarjoaja|Yrityksen tiedot)/.test(text)));
    assert.ok(termsText);
    assert.match(termsText.children[0], /14 päivän kuluessa sopimuksen tekemisestä/);
    if (title === 'Maksuehdot') {
      assert.match(termsText.children[0], /Finn Tuote[\s\S]*2640397-5[\s\S]*lumitoimeksiannot@gmail\.com/);
      assert.match(termsText.children[0], /Paytrailin maksupalvelussa/);
      assert.doesNotMatch(termsText.children[0], /toimitusmaksu|alkuperäinen pakkaus|Ennakkomaksu/);
    }
    assert.equal(termsScreen.props.style[1].backgroundColor, 'rgba(0, 0, 0, 0.5)');
    termsPage.find((node) => node.props.accessibilityLabel === 'Takaisin').props.onPress();
  }
});
