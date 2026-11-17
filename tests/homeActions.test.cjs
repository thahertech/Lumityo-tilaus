const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const dependencies = {
  react: { __esModule: true, default: React },
  'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', Animated: { Image: 'Animated.Image', View: 'Animated.View' }, StyleSheet: { create: (styles) => styles, hairlineWidth: 1 } },
  '@react-navigation/native': {},
  'react-native-safe-area-context': {},
  '@expo/vector-icons': { Ionicons: 'Icon' },
  '../ThemeContext': {},
  '../theme': { fonts: {}, typography: {} },
  '../components/ScreenHeader': {},
  '../NotificationLabel': {},
  '../components/HomeSnow': { Snowfall: 'Snowfall' },
  '../components/HomeSnowContext': {},
  '../components/OuluWeatherBadge': { __esModule: true, default: 'OuluWeatherBadge' },
  '../FreeOrderUtils': {},
  '../SupabaseAPI': {},
  '../PackageAPI': { PACKAGE_PREVIEW_ENABLED: false },
  './PackageScreen': {},
  '../assets/image.png': {},
  '../assets/tractor-ground.png': {},
  '../assets/tractor-snowbank.png': {},
  '../assets/home-snowfield.png': {},
  '../assets/home-snow-mountain.png': {},
  '../assets/tractor-snowfall.png': {},
};
const source = fs.readFileSync(path.join(__dirname, '..', 'screens', 'HomeScreen.js'), 'utf8');
const { code } = babel.transformSync(`${source}\nexport { HomeAction, TractorAndSnow };`, {
  filename: 'HomeScreen.js',
  configFile: false,
  babelrc: false,
  plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
});
const context = {
  exports: {},
  __DEV__: false,
  require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  },
};
vm.runInNewContext(code, context);

function flattenStyle(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

function rgb(hex) {
  return hex.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16));
}

function luminance(color) {
  const [r, g, b] = color.map((component) => {
    const value = component / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function foregroundNodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [
    ...(['Text', 'Icon'].includes(element.type) ? [element] : []),
    ...element.children.flatMap(foregroundNodes),
  ];
}

test('home action text and icons have sufficient contrast', () => {
  const theme = { colors: { onPrimary: '#FFFFFF', primary: '#28669B', border: 'rgba(255,255,255,0.30)' }, shadows: {} };
  for (const variant of [{ primary: true }, { neutral: true }, {}]) {
    const button = context.exports.HomeAction({ title: 'Title', subtitle: 'Subtitle', theme, ...variant });
    const surface = button.children[0];
    const background = flattenStyle(surface.props.style).backgroundColor;
    for (const node of foregroundNodes(surface)) {
      const color = node.type === 'Icon' ? node.props.color : flattenStyle(node.props.style).color;
      const values = [luminance(rgb(color)), luminance(rgb(background))].sort((a, b) => b - a);
      assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${color} on ${background}`);
    }
  }
});

test('home action icons have balanced room between the button edge and divider', () => {
  const theme = { colors: { onPrimary: '#FFFFFF', primary: '#28669B', border: 'rgba(255,255,255,0.30)' }, shadows: {} };
  for (const variant of [{ primary: true }, { neutral: true }, {}]) {
    const surface = context.exports.HomeAction({ title: 'Title', subtitle: 'Subtitle', theme, ...variant }).children[0];
    const actionStyle = flattenStyle(surface.props.style);
    const iconContainer = surface.children[0];
    const iconStyle = flattenStyle(iconContainer.props.style);
    const icon = iconContainer.children[0];
    const left = (actionStyle.paddingLeft || 0) + (actionStyle.borderWidth || 0);
    const center = left + (iconStyle.width - iconStyle.borderRightWidth) / 2;
    const divider = left + iconStyle.width - iconStyle.borderRightWidth / 2;
    const leftSpace = center - icon.props.size / 2;
    const rightSpace = divider - center - icon.props.size / 2;
    assert.ok(leftSpace >= 20 && rightSpace >= 20);
    assert.ok(Math.abs(leftSpace - rightSpace) <= 1);
  }
});

test('all home actions have subtle borders suited to their background', () => {
  for (const border of ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.24)']) {
    const theme = { colors: { onPrimary: '#FFFFFF', primary: '#28669B', border }, shadows: {} };
    for (const variant of [{ primary: true }, { neutral: true }, {}]) {
      const surface = context.exports.HomeAction({ title: 'Title', theme, ...variant }).children[0];
      const style = flattenStyle(surface.props.style);
      assert.equal(style.borderWidth, 1);
      assert.equal(style.borderColor, variant.neutral ? 'rgba(0, 0, 0, 0.12)' : border);
    }
  }
});

test('keeps the original tractor above its decorative layer at different screen sizes', () => {
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024]]) {
    const hero = context.exports.TractorAndSnow({ width, height });
    const frame = hero.children[2].children[0];
    assert.equal(frame.props.accessibilityLabel, 'Lumityötä tekevä traktori');
    const artboard = frame.children[0];
    const [ground, image] = artboard.children;
    assert.equal(ground.props.source, dependencies['../assets/tractor-ground.png']);
    assert.equal(ground.props.pointerEvents, 'none');
    assert.equal(image.props.source, dependencies['../assets/image.png']);
    assert.equal(image.props.resizeMode, 'contain');
    const artWidth = artboard.props.style[1].width;
    assert.ok(artWidth > 0 && artWidth <= 850);
    assert.ok(artWidth / (724 / 241) <= frame.props.style[1].height + 1e-9);
  }
});

test('aligns the snowfall landing area with the tractor artwork at different screen sizes', () => {
  const accumulation = { interpolate: (options) => options };
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024]]) {
    const hero = context.exports.TractorAndSnow({ width, height, accumulation, snowing: true });
    const [tractor, snowfall] = hero.children[1].children;
    const artboard = tractor.children[0];
    const artWidth = artboard.props.style[1].width;
    const artHeight = artWidth * 241 / 724;
    const frame = flattenStyle(snowfall.props.style);
    assert.equal(frame.width, artWidth);
    assert.equal(snowfall.children[0].props.artworkHeight, artHeight);
    assert.ok(Math.abs(frame.transform[0].translateY + frame.height - artHeight / 2
      - flattenStyle(tractor.props.style).transform[0].translateY) < 1e-8);
    assert.equal(artboard.children.length, 3, 'no artificial snow lines cover the image');
    assert.equal(snowfall.props.pointerEvents, 'none');
  }
});

test('anchors the weather badge to the visible hero rather than the oversized tractor', () => {
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024]]) {
    const hero = context.exports.TractorAndSnow({ width, height });
    const frame = hero.children[2].children[0];
    assert.ok(hero.children[1].children.some((child) => child?.type === 'OuluWeatherBadge'));
    assert.ok(!frame.children.some((child) => child && child.type === 'OuluWeatherBadge'));
  }
});

test('positions the tractor lower into the snow without moving the actions', () => {
  const hero = context.exports.TractorAndSnow({ width: 390, height: 844 });
  const artwork = hero.children[2];
  const tractor = flattenStyle(artwork.children[0].props.style);
  assert.equal(artwork.props.style.justifyContent, 'flex-end');
  assert.ok(tractor.transform[0].translateY > 0);
  assert.ok(tractor.transform[0].translateY < hero.props.style.paddingBottom);
});

test('shows textured ground immediately and adds snow behind the tractor', () => {
  const accumulation = { interpolate: (options) => options };
  for (const value of [accumulation, undefined]) {
    const hero = context.exports.TractorAndSnow({ width: 390, height: 844, accumulation: value });
    const artboard = hero.children[1].children[0].children[0];
    const [ground, field, image] = artboard.children;
    assert.equal(ground.props.source, dependencies['../assets/tractor-ground.png']);
    assert.equal(field.props.pointerEvents, 'none');
    assert.equal(field.children[0].props.source, dependencies['../assets/home-snowfield.png']);
    assert.ok(field.children[0].props.style.opacity >= 0.8);
    if (value) assert.equal(field.children[1].props.style[1].opacity.outputRange[1], 0);
    else assert.equal(field.children[1], undefined);
    assert.equal(image.props.source, dependencies['../assets/image.png']);
  }
});
