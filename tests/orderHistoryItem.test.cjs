const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
};
const theme = {
  colors: {},
  fonts: {},
  typography: { caption: {} },
};
const dependencies = {
  react: { __esModule: true, default: React },
  'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: (styles) => styles, hairlineWidth: 1 } },
  '@expo/vector-icons': { Ionicons: 'Icon' },
  '../styles': { __esModule: true, default: () => ({}) },
  '../ThemeContext': { useTheme: () => ({ theme }) },
};
const source = fs.readFileSync(path.join(__dirname, '..', 'components', 'OrderHistoryItem.js'), 'utf8');
const { code } = babel.transformSync(source, {
  filename: 'OrderHistoryItem.js',
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

function textNodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [
    ...(element.type === 'Text' ? [element] : []),
    ...element.children.flatMap(textNodes),
  ];
}

test('keeps status, address, price and the complete note visible', () => {
  const note = 'Pitkä lisätieto lumitöistä, joka pitää näyttää kokonaisuudessaan.';
  const card = context.exports.default({ item: {
    palvelu: 'Lumityö', status: 'in-progress', address: 'Lumitie 1',
    created_at: '2026-01-15T12:00:00Z', price: '10–20 €', notes: note,
  } });
  const header = card.children[0];
  assert.ok(textNodes(header).some((node) => node.children.includes('Työn alla')));
  const texts = textNodes(card);
  for (const value of ['Lumityö', 'Lumitie 1', '10–20 €', note]) {
    assert.ok(texts.some((node) => node.children.includes(value)), `Missing ${value}`);
  }
  assert.equal(texts.find((node) => node.children.includes(note)).props.numberOfLines, undefined);
});

test('shows a zero price and free order, but omits an absent price', () => {
  const item = { palvelu: 'Lumityö', status: 'completed', created_at: '2026-01-15T12:00:00Z', is_free_order: 1 };
  const texts = textNodes(context.exports.default({ item: { ...item, price: 0 } }));
  assert.ok(texts.some((node) => node.children.includes(0)));
  assert.ok(texts.some((node) => node.children.includes('Ilmainen tilaus')));
  const noPrice = textNodes(context.exports.default({ item }));
  assert.ok(!noPrice.some((node) => node.children.includes(0)));
});

test('shows package balance at reservation and indicates a restored round', () => {
  const item = { palvelu: 'Lumityö', status: 'completed', created_at: '2026-01-15', package_remaining_after: 9 };
  let texts = textNodes(context.exports.default({ item }));
  assert.ok(texts.some(node => node.children.includes('Paketissa tilauksen jälkeen 9/10')));
  texts = textNodes(context.exports.default({ item: { ...item, package_restored: true } }));
  assert.ok(texts.some(node => node.children.includes('Pakettikerta palautettu')));
});
