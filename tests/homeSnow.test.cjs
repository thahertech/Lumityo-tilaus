const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function loadSnow(reduceMotion = false, initialAppState = 'active') {
  const timers = new Map();
  const animations = [];
  let nextTimer = 1;
  let appListener;
  let cleanup;
  const values = [];
  let snowing = false;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useCallback: (callback) => callback,
    useEffect() {},
    useRef: (initial) => ({ current: initial }),
    useState: () => [snowing, (next) => { snowing = next; }],
  };
  const AppState = {
    currentState: initialAppState,
    addEventListener: (_name, listener) => {
      appListener = listener;
      return { remove: () => { appListener = undefined; } };
    },
  };
  const Animated = {
    Value: class {
      constructor(initial) { this.value = initial; values.push(this); }
      setValue(next) { this.value = next; }
    },
    timing: (target, options) => {
      const animation = { target, options, started: false, stopped: false };
      animation.start = () => { animation.started = true; };
      animation.stop = () => { animation.stopped = true; };
      animations.push(animation);
      return animation;
    },
  };
  const dependencies = {
    react: { __esModule: true, default: React, ...React },
    'react-native': { Animated, AppState, Platform: { OS: 'ios' }, Easing: { linear: 'linear' }, StyleSheet: { absoluteFill: 'fill', create: (styles) => styles }, View: 'View' },
    '@react-navigation/native': { useFocusEffect: (callback) => { cleanup = callback(); } },
  };
  const source = fs.readFileSync(path.join(__dirname, '../components/HomeSnow.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, console,
    setTimeout: (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(code, context);
  context.exports.useHomeSnow(reduceMotion);
  return {
    timers, animations, values,
    get snowing() { return snowing; },
    runTimer() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
    },
    changeState(state) { AppState.currentState = state; appListener(state); },
    blur() { cleanup(); },
  };
}

test('starts and resets accumulation with the focused homepage', () => {
  const snow = loadSnow();
  assert.equal(snow.snowing, false);
  assert.equal(snow.timers.size, 1);
  assert.equal([...snow.timers.values()][0].delay, 800);
  snow.runTimer();
  assert.equal(snow.snowing, true);
  assert.equal(snow.animations[0].started, true);
  assert.equal(snow.animations[0].options.duration, 15000);
  assert.equal(snow.animations[0].options.useNativeDriver, true);
  assert.equal(snow.animations[1].started, true);
  assert.equal(snow.animations[1].options.duration, 15000);
  assert.equal(snow.animations[1].options.useNativeDriver, true);
  snow.changeState('background');
  assert.equal(snow.snowing, false);
  assert.equal(snow.animations[0].stopped, true);
  assert.equal(snow.animations[1].stopped, true);
  assert.ok(snow.values.every((value) => value.value === 0));
  snow.changeState('active');
  assert.equal([...snow.timers.values()][0].delay, 800);
  snow.blur();
  assert.equal(snow.timers.size, 0);
});

test('does not start while motion is reduced or the app is backgrounded', () => {
  for (const setting of [true, null]) {
    const snow = loadSnow(setting);
    assert.equal(snow.timers.size, 0);
    assert.equal(snow.animations.length, 0);
    snow.blur();
  }
  const background = loadSnow(false, 'background');
  assert.equal(background.timers.size, 0);
  background.changeState('active');
  assert.equal(background.timers.size, 1);
  background.blur();
});

function loadSnowfall(platform = 'ios') {
  const hooks = [];
  const animations = [];
  let cursor = 0;
  let pendingEffects = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useRef(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { current: initial };
      return hooks[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], (next) => {
        hooks[index] = typeof next === 'function' ? next(hooks[index]) : next;
      }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        pendingEffects.push(() => {
          if (previous?.cleanup) previous.cleanup();
          hooks[index] = { dependencies, cleanup: effect() };
        });
      }
    },
    useCallback: (callback) => callback,
  };
  const Animated = {
    View: 'Animated.View',
    Value: class {
      setValue(value) { this.value = value; }
      interpolate(options) { return options; }
    },
    timing: (_value, options) => {
      const animation = { options, stopped: false };
      animation.start = (callback) => { animation.complete = callback; };
      animation.stop = () => { animation.stopped = true; };
      animations.push(animation);
      return animation;
    },
    loop: (animation) => { animation.looping = true; return animation; },
  };
  const dependencies = {
    react: { __esModule: true, default: React, ...React },
    'react-native': { Animated, Platform: { OS: platform }, Easing: { linear: 'linear' }, StyleSheet: { absoluteFill: 'fill', hairlineWidth: 1, create: (styles) => styles }, View: 'View' },
    '@react-navigation/native': { useFocusEffect() {} },
  };
  const source = fs.readFileSync(path.join(__dirname, '../components/HomeSnow.js'), 'utf8');
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
  return {
    animations,
    render() {
      cursor = 0;
      pendingEffects = [];
      const tree = context.exports.Snowfall({ artworkHeight: 140 });
      pendingEffects.forEach((effect) => effect());
      return tree;
    },
  };
}

test('renders softly colored flakes in a non-interactive native overlay', () => {
  const snow = loadSnowfall();
  const initial = snow.render();
  assert.equal(initial.props.pointerEvents, 'none');
  assert.equal(initial.props.importantForAccessibility, 'no-hide-descendants');
  assert.equal(initial.props.style[1].overflow, 'hidden');
  initial.props.onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } });
  const tree = snow.render();
  const flakes = tree.children[0];
  assert.equal(flakes.length, 64);
  assert.equal(snow.animations[0].options.useNativeDriver, true);
  assert.equal(snow.animations[0].looping, true);

  assert.ok(new Set(flakes.map((flake) => flake.props.style[1].backgroundColor)).size >= 3);
  assert.ok(flakes.every((flake) => flake.props.style[1].width <= 4.2
    && flake.props.style[1].borderRadius === flake.props.style[1].width / 2
    && !flake.props.style[0].borderColor
    && flake.children.length === 0));
});

test('flakes fall onto the tractor or ground and fade after settling', () => {
  const snow = loadSnowfall();
  snow.render().props.onLayout({ nativeEvent: { layout: { width: 400, height: 240 } } });
  const flakes = snow.render().children[0];
  const landings = new Set();
  for (const flake of flakes) {
    const { opacity, transform } = flake.props.style[1];
    const y = transform[1].translateY.outputRange;
    const maxY = Math.max(...y);
    landings.add(Math.round(maxY));
    assert.ok(maxY <= 240);
    assert.ok(opacity.outputRange.some((value, index) => value > 0 && Math.abs(y[index] - maxY) < 0.001));
    assert.ok(opacity.outputRange.some((value, index) => value < 0.001 && Math.abs(y[index] - maxY) < 0.001));
    assert.equal(opacity.extrapolate, 'clamp');
  }
  assert.ok(landings.has(111), 'some flakes settle on the roof');
  assert.ok(landings.has(236), 'some flakes settle on the ground');
  assert.ok(landings.size >= 4, 'flakes settle at multiple surface heights');
});

test('the looping snow has no position or opacity jump at the loop boundary', () => {
  const snow = loadSnowfall();
  snow.render().props.onLayout({ nativeEvent: { layout: { width: 400, height: 240 } } });
  const flakes = snow.render().children[0];
  for (const flake of flakes) {
    const { opacity, transform } = flake.props.style[1];
    for (const interpolation of [opacity, transform[0].translateX, transform[1].translateY]) {
      assert.ok(Math.abs(interpolation.outputRange[0] - interpolation.outputRange.at(-1)) < 1e-8);
      assert.ok(interpolation.inputRange.every((time, index, range) => index === 0 || time > range[index - 1]));
    }
  }
});

test('snow stays present throughout the loop without visible position jumps', () => {
  const snow = loadSnowfall();
  snow.render().props.onLayout({ nativeEvent: { layout: { width: 400, height: 240 } } });
  const flakes = snow.render().children[0];
  const valueAt = ({ inputRange, outputRange }, time) => {
    const index = inputRange.findIndex((end) => end >= time);
    if (index <= 0) return outputRange[0];
    const portion = (time - inputRange[index - 1]) / (inputRange[index] - inputRange[index - 1]);
    return outputRange[index - 1] + portion * (outputRange[index] - outputRange[index - 1]);
  };
  for (let time = 0; time < 12000; time += 100) {
    let visible = 0;
    for (const flake of flakes) {
      const { opacity, transform } = flake.props.style[1];
      if (valueAt(opacity, time) <= 0.05) continue;
      visible += 1;
      if (valueAt(opacity, time + 100) > 0.05) {
        const x = transform[0].translateX;
        const y = transform[1].translateY;
        assert.ok(Math.abs(valueAt(x, time + 100) - valueAt(x, time)) < 8);
        assert.ok(Math.abs(valueAt(y, time + 100) - valueAt(y, time)) < 8);
      }
    }
    assert.ok(visible >= 15, `too few flakes at ${time}ms`);
  }
});

test('uses the web-compatible driver and restarts only when the overlay size changes', () => {
  const snow = loadSnowfall('web');
  const initial = snow.render();
  const layout = (width) => initial.props.onLayout({ nativeEvent: { layout: { width, height: 800 } } });
  layout(400);
  snow.render();
  assert.equal(snow.animations[0].options.useNativeDriver, false);
  layout(400);
  snow.render();
  assert.equal(snow.animations.length, 1);
  layout(600);
  snow.render();
  assert.equal(snow.animations.length, 2);
  assert.equal(snow.animations[0].stopped, true);
});
