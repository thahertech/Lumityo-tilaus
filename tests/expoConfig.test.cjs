const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

test('preserves the static Expo config while adding runtime environment values', () => {
  const root = path.join(__dirname, '..');
  const staticConfig = require(path.join(root, 'app.json')).expo;
  const source = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {},
    process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'example-url' } },
    require: (name) => {
      assert.equal(name, 'dotenv/config');
      return {};
    },
  };
  vm.runInNewContext(code, context);
  const config = context.exports.default({ config: staticConfig });
  assert.equal(config.ios.bundleIdentifier, staticConfig.ios.bundleIdentifier);
  assert.equal(config.extra.eas.projectId, staticConfig.extra.eas.projectId);
  assert.equal(config.extra.supabaseUrl, 'example-url');
  assert.ok(config.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'));
});

test('production builds use EAS environment values without literal profile overrides', () => {
  const { build, cli } = require(path.join(__dirname, '..', 'eas.json'));
  assert.equal(build.production.environment, 'production');
  assert.equal(build.production.env, undefined);
  assert.equal(cli.appVersionSource, 'remote');
  assert.equal(build.production.autoIncrement, true);
});

test('keeps an ASCII native project name and the original installed app name', () => {
  const config = require(path.join(__dirname, '..', 'app.json')).expo;
  assert.match(config.name, /^[A-Za-z0-9]+$/);
  assert.equal(config.ios.infoPlist.CFBundleDisplayName, 'Lumityöt');
  assert.ok(config.plugins.includes('./plugins/withAndroidDisplayName'));
});
