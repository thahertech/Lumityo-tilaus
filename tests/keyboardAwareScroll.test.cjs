const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function loadModule(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, console,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

test('focused input scrolls into view when the keyboard reduces the viewport', () => {
  const listeners = {};
  const refs = [];
  const state = [];
  let refIndex = 0;
  let stateIndex = 0;
  let effect;
  let measurementCallback;
  const scrolls = [];
  const reactNative = {
    Keyboard: { addListener: (name, callback) => {
      listeners[name] = callback;
      return { remove() { delete listeners[name]; } };
    } },
    UIManager: { measureLayout: (_target, _content, _failure, success) => {
      measurementCallback = success;
      success(0, 600, 200, 54);
    } },
  };
  const react = {
    useRef: (initial) => {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    },
    useEffect: (callback) => { if (!effect) effect = callback(); },
  };
  const helper = loadModule('utils/keyboardScroll.js', { 'react-native': reactNative });
  const hook = loadModule('hooks/useKeyboardAwareScroll.js', {
    react, 'react-native': reactNative, '../utils/keyboardScroll': helper,
  }).default;
  const render = () => { refIndex = 0; stateIndex = 0; return hook(); };
  let handlers = render();
  handlers.scrollViewRef.current = {
    getInnerViewNode: () => 'content',
    scrollTo: (value) => scrolls.push(value),
  };
  handlers.onLayout({ nativeEvent: { layout: { height: 700 } } });
  handlers.onFocusInput({ nativeEvent: { target: 7 } });
  assert.equal(scrolls.length, 0);
  listeners.keyboardDidShow();
  handlers.onLayout({ nativeEvent: { layout: { height: 300 } } });
  assert.equal(scrolls.at(-1).y, 366);
  handlers = render();
  assert.equal(handlers.keyboardVisible, true);
  handlers.onBlurInput({ nativeEvent: { target: 7 } });
  measurementCallback(0, 600, 200, 54);
  assert.equal(scrolls.length, 1, 'stale measurements must not scroll an unfocused field');
  listeners.keyboardDidHide();
  assert.equal(render().keyboardVisible, false);
  effect();
  assert.equal(Object.keys(listeners).length, 0);
});
