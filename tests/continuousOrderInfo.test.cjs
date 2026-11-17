const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

let state;
let stateIndex;
let refs = [];
let refIndex;
let alerts = [];
let emails = [];
let emailError = null;
let profileWrites = [];
let settingWrites = [];
let settingsResult = null;
let settingsError = null;
const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useCallback: (callback) => callback,
};
const useState = (initial) => {
  const index = stateIndex++;
  if (!(index in state)) state[index] = initial;
  return [state[index], (value) => { state[index] = value; }];
};
const useRef = (initial) => {
  const index = refIndex++;
  if (!refs[index]) refs[index] = { current: initial };
  return refs[index];
};
const themeSource = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
const themeCode = babel.transformSync(themeSource, {
  filename: 'theme.js',
  configFile: false,
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const themeContext = { exports: {} };
vm.runInNewContext(themeCode, themeContext);
const { lightTheme, darkTheme } = themeContext.exports;
let theme = lightTheme;
const dependencies = {
  react: { __esModule: true, default: React, useState, useRef, useEffect: () => {} },
  'react-native': {
    View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'Button',
    Switch: 'Switch', ScrollView: 'ScrollView', Modal: 'Modal',
    KeyboardAvoidingView: 'KeyboardAvoidingView', StatusBar: 'StatusBar',
    ActivityIndicator: 'ActivityIndicator', Image: 'Image',
    Alert: { alert: (...args) => alerts.push(args) },
    Platform: { OS: 'ios' }, StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
  },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  '@react-navigation/native': { useNavigation: () => ({}), useFocusEffect: () => {} },
  '@react-native-async-storage/async-storage': {},
  'expo-linear-gradient': {},
  '@expo/vector-icons': { Ionicons: 'Icon' },
  'emailjs-com': { send: async (...args) => { emails.push(args); if (emailError) throw emailError; } },
  '../styles': { __esModule: true, default: () => ({}) },
  '../ThemeContext': { useTheme: () => ({ theme, mode: theme.mode }) },
  '../components/ScreenHeader': { screenLayout: {} },
  '../components/AddressAutocompleteMapboxNew': { __esModule: true, default: 'AddressAutocomplete' },
  '../FreeOrderUtils': { getDeviceId: async () => 'test-device' },
  '../SupabaseAPI': {
    getOrderSettings: async (deviceId, options) => {
      assert.equal(deviceId, 'test-device');
      assert.equal(options.throwOnError, true);
      if (settingsError) throw settingsError;
      return settingsResult;
    },
    upsertUserProfile: async (deviceId, profile) => {
      profileWrites.push({ deviceId, profile });
      return { success: true, profile };
    },
    saveOrderSettings: async (deviceId, settings) => {
      settingWrites.push({ deviceId, settings });
      return { success: true };
    },
    getOrdersByDevice: async () => [],
  },
};
const source = fs.readFileSync(path.join(__dirname, '..', 'screens', 'OmatTiedotScreen.js'), 'utf8');
const { code } = babel.transformSync(source, {
  filename: 'OmatTiedotScreen.js',
  configFile: false,
  babelrc: false,
  plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
});
const context = {
  exports: {},
  process: { env: {} },
  require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  },
};
vm.runInNewContext(code, context);

function render() {
  stateIndex = 0;
  refIndex = 0;
  return context.exports.default({});
}

function nodes(element) {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  return [element, ...element.children.flatMap(nodes)];
}

function text(element) {
  return nodes(element).filter((node) => node.type === 'Text')
    .map((node) => node.children.filter((child) => typeof child === 'string').join(''));
}

function button(tree, label) {
  return nodes(tree).find((node) => node.type === 'Button' && text(node).includes(label));
}

function style(node) {
  return Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
}

function luminance(color) {
  const rgb = color.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16) / 255);
  return rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('terms use a readable light panel in light mode and retain the dark panel in dark mode', () => {
  for (const currentTheme of [lightTheme, darkTheme]) {
    theme = currentTheme;
    state = ['Maija', 'Lumitie 1', '123456', '', null, [], false, '', true, false];
    const tree = render();
    const modal = nodes(tree).find((node) => node.type === 'Modal' && node.props.visible);
    const panel = nodes(modal).find((node) => node.props.accessibilityViewIsModal);
    const background = style(panel).backgroundColor;
    assert.equal(background, currentTheme.mode === 'light' ? currentTheme.colors.surfaceRaised : currentTheme.colors.panel);
    for (const node of nodes(modal).filter((item) => item.type === 'Text' && !item.children.includes('Sulje'))) {
      assert.ok(contrast(style(node).color, background) >= 4.5);
    }
    const close = button(modal, 'Sulje');
    assert.ok(contrast(style(nodes(close).find((node) => node.type === 'Text')).color, style(close).backgroundColor) >= 4.5);

  }
  theme = lightTheme;
});

test('contact form matches each theme with readable text and fields', () => {
  for (const currentTheme of [lightTheme, darkTheme]) {
    theme = currentTheme;
    state = ['Maija', 'Lumitie 1', '123456', '', null, [], false, '', false, false, false, true];
    const modal = nodes(render()).find((node) => node.type === 'Modal' && node.props.visible);
    const panel = nodes(modal).find((node) => node.props.accessibilityViewIsModal);
    const background = style(panel).backgroundColor;
    assert.equal(background, currentTheme.mode === 'light' ? currentTheme.colors.surfaceRaised : currentTheme.colors.panel);
    for (const label of ['Ota yhteyttä', 'Laita viesti - otamme sinuun yhteyttä pian!', 'Sähköpostiosoite', 'Viesti']) {
      const labelNode = nodes(modal).find((node) => node.type === 'Text' && node.children.includes(label));
      assert.ok(contrast(style(labelNode).color, background) >= 4.5, label);
    }
    for (const input of nodes(modal).filter((node) => node.type === 'TextInput')) {
      const inputBackground = currentTheme.mode === 'light' ? style(input).backgroundColor : '#161616';
      assert.ok(contrast(style(input).color, inputBackground) >= 4.5);
      assert.ok(contrast(input.props.placeholderTextColor, inputBackground) >= 4.5);
    }
  }
  theme = lightTheme;
});

test('profile inputs use the same light surface and readable text as the contact form', () => {
  for (const currentTheme of [lightTheme, darkTheme]) {
    theme = currentTheme;
    state = ['Maija', 'Lumitie 1', '123456', '', null, [], false, '', false, false];
    const tree = render();
    const profileInputs = nodes(tree).filter((node) =>
      node.type === 'TextInput' && ['Nimi', 'Puhelinnumero', 'Sähköposti'].includes(node.props.accessibilityLabel));
    const address = nodes(tree).find((node) => node.type === 'AddressAutocomplete');
    const expectedBackground = currentTheme.mode === 'light' ? currentTheme.colors.input : 'rgba(12, 12, 12, 0.65)';
    for (const input of [...profileInputs, address]) {
      const inputStyle = input === address ? input.props.inputStyle : style(input);
      assert.equal(inputStyle.backgroundColor, expectedBackground);
      assert.equal(inputStyle.color, currentTheme.mode === 'light' ? currentTheme.colors.controlText : currentTheme.colors.textPrimary);
      assert.equal(input.props.placeholderTextColor, currentTheme.mode === 'light' ? currentTheme.colors.inputPlaceholder : '#D4D4D4');
      if (currentTheme.mode === 'light') {
        assert.ok(contrast(inputStyle.color, expectedBackground) >= 4.5);
        assert.ok(contrast(input.props.placeholderTextColor, expectedBackground) >= 4.5);
      }
    }
  }
  theme = lightTheme;
});

test('address inputs use the shared light surface including the street-number dialog', () => {
  const addressSource = fs.readFileSync(path.join(__dirname, '..', 'components', 'AddressAutocompleteMapboxNew.js'), 'utf8');
  const { code: addressCode } = babel.transformSync(`${addressSource}\nexport { createStyles };`, {
    filename: 'AddressAutocompleteMapboxNew.js',
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const addressContext = {
    exports: {},
    require: (name) => {
      if (name === 'expo-constants') return {};
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(addressCode, addressContext);
  for (const currentTheme of [lightTheme, darkTheme]) {
    const addressStyles = addressContext.exports.createStyles(currentTheme);
    for (const field of [addressStyles.textInput, addressStyles.katuNumeroInput]) {
      assert.equal(field.backgroundColor, currentTheme.colors.input);
      assert.ok(contrast(field.color, field.backgroundColor) >= 4.5);
      assert.ok(contrast(currentTheme.colors.inputPlaceholder, field.backgroundColor) >= 4.5);
    }
  }
});

test('contact form scrolls the focused field into view when its viewport changes', () => {
  refs = [];
  state = ['Maija', 'Lumitie 1', '123456', '', null, [], false, '', false, false, false, true];
  const modal = nodes(render()).find((node) => node.type === 'Modal' && node.props.visible);
  const scroll = nodes(modal).find((node) => node.type === 'ScrollView');
  const panel = nodes(scroll).find((node) => node.props.accessibilityViewIsModal);
  const calls = [];
  scroll.props.ref.current = { scrollTo: (options) => calls.push(options) };
  panel.props.onLayout({ nativeEvent: { layout: { y: 20 } } });
  const email = nodes(panel).find((node) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Sähköpostiosoite');
  const message = nodes(panel).find((node) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Viesti');
  const fields = nodes(panel).filter((node) => node.type === 'View' && node.props.onLayout && node.children.some((child) => child?.type === 'TextInput'));
  fields.find((node) => nodes(node).includes(email)).props.onLayout({ nativeEvent: { layout: { y: 110 } } });
  fields.find((node) => nodes(node).includes(message)).props.onLayout({ nativeEvent: { layout: { y: 210 } } });
  email.props.onFocus();
  assert.equal(calls.at(-1).y, 118);
  email.props.onBlur();
  message.props.onFocus();
  assert.equal(calls.at(-1).y, 218);
  scroll.props.onLayout();
  assert.equal(calls.at(-1).y, 218);
  assert.ok(button(scroll, 'Peruuta'));
  assert.ok(button(scroll, 'Lähetä'));
  assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled');
  message.props.onBlur();
  const previousCalls = calls.length;
  scroll.props.onLayout();
  assert.equal(calls.length, previousCalls);
});

test('opens and closes the scrollable order information without changing the setting', () => {
  state = ['Maija', 'Lumitie 1', '123456', '', null, [], false, '', false, false];
  let tree = render();
  const infoButton = button(tree, 'Lue jatkuvan tilauksen ehdot');
  assert.ok(infoButton);
  assert.equal(infoButton.props.accessibilityRole, 'button');
  assert.ok(text(tree).includes('Kun asetus on käytössä, lumityöt tehdään automaattisesti ilman erillistä tilausta.'));
  assert.equal(nodes(tree).find((node) => node.type === 'Switch').props.value, false);

  infoButton.props.onPress();
  tree = render();
  const modal = nodes(tree).find((node) => node.type === 'Modal' && node.props.visible);
  assert.ok(modal);
  assert.ok(nodes(modal).some((node) => node.type === 'ScrollView'));
  for (const section of ['Toiminta', 'Laskutus', 'Peruutus']) assert.ok(text(modal).includes(section));
  assert.ok(text(modal).some((value) => value.includes('Kun lumitöitä on kertynyt 5 kertaa')));
  assert.ok(text(modal).some((value) => value.includes('Voit ottaa asetuksen pois päältä milloin tahansa')));
  assert.ok(!text(modal).some((value) => /\p{Extended_Pictographic}/u.test(value)));

  button(modal, 'Sulje').props.onPress();
  tree = render();
  assert.ok(!nodes(tree).some((node) => node.type === 'Modal' && node.props.visible));
  assert.equal(nodes(tree).find((node) => node.type === 'Switch').props.value, false);

  button(tree, 'Lue jatkuvan tilauksen ehdot').props.onPress();
  tree = render();
  nodes(tree).find((node) => node.type === 'Modal' && node.props.visible).props.onRequestClose();
  assert.ok(!nodes(render()).some((node) => node.type === 'Modal' && node.props.visible));
});

test('retains the setting status and missing-details guidance', () => {
  state = ['', '', '', '', null, [], false, '', false, false];
  let tree = render();
  assert.ok(text(tree).some((value) => value.startsWith('Täytä ensin pakolliset tiedot')));
  assert.ok(button(tree, 'Lue jatkuvan tilauksen ehdot'));

  state[6] = true;
  tree = render();
  assert.ok(text(tree).some((value) => value.startsWith('Jatkuva tilaus -asetus on käytössä')));
  assert.equal(nodes(tree).find((node) => node.type === 'Switch').props.value, true);
});

test('keeps the profile fields and places contact after appearance settings', () => {
  state = ['Maija', 'Lumitie 1', '123456', 'maija@example.com', null, [], false, '', false, false];
  const tree = render();
  const labels = text(tree);
  assert.ok(labels.indexOf('Ulkoasu') < labels.indexOf('Ota yhteyttä'));
  const inputs = nodes(tree).filter((node) => node.type === 'TextInput');
  for (const [label, value] of [['Nimi', 'Maija'], ['Puhelinnumero', '123456'], ['Sähköposti', 'maija@example.com']]) {
    assert.ok(inputs.some((input) => input.props.accessibilityLabel === label && input.props.value === value));
  }
  const address = nodes(tree).find((node) => node.type === 'AddressAutocomplete');
  assert.equal(address.props.value, 'Lumitie 1');
  address.props.onAddressSelect({ displayAddress: 'Lumitie 2' });
  assert.equal(nodes(render()).find((node) => node.type === 'AddressAutocomplete').props.value, 'Lumitie 2');
});

test('contact form opens, validates, submits and closes', async () => {
  state = ['Maija', 'Lumitie 1', '123456', '', null, [], false, '', false, false];
  alerts = [];
  emails = [];
  let tree = render();
  button(tree, 'Ota yhteyttä').props.onPress();
  tree = render();
  let modal = nodes(tree).find((node) => node.type === 'Modal' && node.props.visible);
  assert.ok(modal);
  assert.ok(nodes(modal).some((node) => node.type === 'ScrollView'));
  const inputs = nodes(modal).filter((node) => node.type === 'TextInput');
  assert.equal(inputs.find((input) => input.props.accessibilityLabel === 'Sähköpostiosoite').props.keyboardType, 'email-address');
  assert.equal(inputs.find((input) => input.props.accessibilityLabel === 'Viesti').props.maxLength, 500);

  await button(modal, 'Lähetä').props.onPress();
  assert.equal(alerts[0][1], 'Kirjoita viestisi ennen lähettämistä.');
  assert.equal(emails.length, 0);

  inputs.find((input) => input.props.accessibilityLabel === 'Viesti').props.onChangeText('Testiviesti');
  inputs.find((input) => input.props.accessibilityLabel === 'Sähköpostiosoite').props.onChangeText('test@example.com');
  tree = render();
  modal = nodes(tree).find((node) => node.type === 'Modal' && node.props.visible);
  await button(modal, 'Lähetä').props.onPress();
  assert.equal(emails.length, 1);
  assert.equal(emails[0][2].message, 'Testiviesti');
  assert.equal(emails[0][2].email, 'test@example.com');
  alerts.at(-1)[2][0].onPress();
  assert.ok(!nodes(render()).some((node) => node.type === 'Modal' && node.props.visible));

  button(render(), 'Ota yhteyttä').props.onPress();
  modal = nodes(render()).find((node) => node.type === 'Modal' && node.props.visible);
  button(modal, 'Peruuta').props.onPress();
  assert.ok(!nodes(render()).some((node) => node.type === 'Modal' && node.props.visible));
});

test('privacy button is hidden while contact remains available', () => {
  state = ['Maija', 'Lumitie 1', '123456', 'test@example.com', null, [], false, '', false, false];
  refs = [];
  const tree = render();
  assert.equal(button(tree, 'Tietosuoja'), undefined);
  assert.ok(button(tree, 'Ota yhteyttä'));
});

test('privacy information opens a prefilled deletion request without sending or deleting automatically', async () => {
  state = ['Maija', 'Lumitie 1', '123456', 'test@example.com', null, [], false, '', false, false];
  refs = [];
  emails = [];
  alerts = [];
  state[17] = true;
  let tree = render();
  const privacy = nodes(tree).find((node) => node.type === 'Modal' && node.props.visible);
  assert.ok(text(privacy).some((value) => value.includes('ei täydellinen tietosuojaseloste')));
  assert.ok(text(privacy).some((value) => value.includes('ei poista tietoja automaattisesti')));
  assert.equal(emails.length, 0);

  button(privacy, 'Pyydä tietojeni poistamista').props.onPress();
  tree = render();
  const contact = nodes(tree).find((node) => node.type === 'Modal' && node.props.visible);
  const inputs = nodes(contact).filter((node) => node.type === 'TextInput');
  assert.equal(inputs.find((input) => input.props.accessibilityLabel === 'Sähköpostiosoite').props.value, 'test@example.com');
  assert.equal(inputs.find((input) => input.props.accessibilityLabel === 'Viesti').props.value, 'Pyydän henkilötietojeni poistamista.');
  assert.equal(emails.length, 0);
  await button(contact, 'Lähetä').props.onPress();
  assert.equal(emails.length, 1);
  assert.equal(emails[0][2].message, 'Pyydän henkilötietojeni poistamista.');
  assert.equal(emails[0][2].email, 'test@example.com');
  assert.equal(alerts.at(-1)[0], 'Viestin lähetetty!');
});

test('asks before replacing a contact draft and retains an existing deletion request', () => {
  state = ['Maija', 'Lumitie 1', '123456', '', null, [], false, '', false, false, false, false, 'Keskeneräinen viesti', 'test@example.com'];
  refs = [];
  alerts = [];
  state[17] = true;
  let privacy = nodes(render()).find((node) => node.type === 'Modal' && node.props.visible);
  button(privacy, 'Pyydä tietojeni poistamista').props.onPress();
  assert.equal(state[12], 'Keskeneräinen viesti');
  assert.equal(state[11], false);
  assert.equal(alerts.at(-1)[0], 'Keskeneräinen viesti');
  alerts.at(-1)[2].find((item) => item.text === 'Korvaa viesti').onPress();
  assert.equal(state[12], 'Pyydän henkilötietojeni poistamista.');

  state[11] = false;
  state[12] = 'Pyydän henkilötietojeni poistamista. Lisätieto.';
  state[17] = true;
  privacy = nodes(render()).find((node) => node.type === 'Modal' && node.props.visible);
  button(privacy, 'Pyydä tietojeni poistamista').props.onPress();
  assert.equal(state[12], 'Pyydän henkilötietojeni poistamista. Lisätieto.');
  assert.equal(state[11], true);
});

test('a failed deletion request stays editable and reports the failure', async () => {
  state = ['Maija', 'Lumitie 1', '123456', 'test@example.com', null, [], false, '', false, false];
  refs = [];
  alerts = [];
  emailError = new Error('test delivery failure');
  state[17] = true;
  button(render(), 'Pyydä tietojeni poistamista').props.onPress();
  const modal = nodes(render()).find((node) => node.type === 'Modal' && node.props.visible);
  await button(modal, 'Lähetä').props.onPress();
  emailError = null;
  assert.equal(alerts.at(-1)[0], 'Virhe');
  assert.equal(state[11], true);
  assert.equal(state[12], 'Pyydän henkilötietojeni poistamista.');
});

test('allows contact details to be cleared or partially saved when continuous service is off', async () => {
  for (const fields of [
    { name: '', address: '', phone: '', email: '' },
    { name: 'Testi', address: '', phone: '', email: '' },
  ]) {
    refs = [];
    alerts = [];
    profileWrites = [];
    settingsResult = null;
    settingsError = null;
    state = [fields.name, fields.address, fields.phone, fields.email,
      { name: 'Vanha', address: 'Vanha osoite', phone: '0400', email: 'old@example.com' },
      [], false, '', false, false];
    await button(render(), 'Tallenna Tiedot').props.onPress();
    assert.equal(profileWrites.length, 1);
    for (const field of ['name', 'address', 'phone', 'email']) {
      assert.equal(profileWrites[0].profile[field], fields[field]);
    }
    assert.equal(alerts.at(-1)[0], 'Onnistui');
    alerts.at(-1)[2][0].onPress();
    assert.equal(state[15], false);
  }
});

test('requires continuous service to be disabled before removing required details', async () => {
  refs = [];
  alerts = [];
  profileWrites = [];
  settingsResult = { continuous_order: true };
  settingsError = null;
  state = ['', '', '', '', { name: 'Testi', address: 'Testitie 1', phone: '0400' },
    [], true, '', false, false];
  await button(render(), 'Tallenna Tiedot').props.onPress();
  assert.equal(profileWrites.length, 0);
  assert.match(alerts.at(-1)[1], /Poista jatkuva tilaus käytöstä/);
  assert.equal(state[6], true);

  await nodes(render()).find((node) => node.type === 'Switch').props.onValueChange(false);
  settingsResult = null;
  await button(render(), 'Tallenna Tiedot').props.onPress();
  assert.equal(state[6], false);
  assert.equal(profileWrites.length, 1);
  assert.equal(profileWrites[0].profile.address, '');
});

test('does not clear details when the continuous service status cannot be checked', async () => {
  refs = [];
  alerts = [];
  profileWrites = [];
  settingsResult = null;
  settingsError = new Error('offline');
  state = ['', '', '', '', { name: 'Testi', address: 'Testitie 1', phone: '0400' },
    [], false, '', false, false];
  await button(render(), 'Tallenna Tiedot').props.onPress();
  assert.equal(profileWrites.length, 0);
  assert.match(alerts.at(-1)[1], /tallentaminen epäonnistui/i);
  settingsError = null;
});

test('continuous service cannot be enabled using unsaved or incomplete profile details', async () => {
  refs = [];
  alerts = [];
  settingWrites = [];
  state = ['Testi', 'Testitie 1', '0400', '', { name: '', address: '', phone: '' },
    [], false, '', false, false];
  await nodes(render()).find((node) => node.type === 'Switch').props.onValueChange(true);
  assert.equal(settingWrites.length, 0);
  assert.match(alerts.at(-1)[1], /tallenna/);
  assert.equal(state[6], false);
});

test('prevents edits and continuous-order changes while clearing the profile', async () => {
  refs = [];
  alerts = [];
  profileWrites = [];
  settingWrites = [];
  state = ['', '', '', '', { name: 'Testi', address: 'Testitie 1', phone: '0400' },
    [], false, '', false, false];
  const api = dependencies['../SupabaseAPI'];
  const original = api.getOrderSettings;
  let resolveSettings;
  api.getOrderSettings = () => new Promise((resolve) => { resolveSettings = resolve; });
  try {
    const save = button(render(), 'Tallenna Tiedot').props.onPress();
    await Promise.resolve();
    const pending = render();
    for (const label of ['Nimi', 'Puhelinnumero', 'Sähköposti']) {
      assert.equal(nodes(pending).find((node) => node.type === 'TextInput' && node.props.accessibilityLabel === label).props.editable, false);
    }
    assert.equal(nodes(pending).find((node) => node.type === 'AddressAutocomplete').props.editable, false);
    const toggle = nodes(pending).find((node) => node.type === 'Switch');
    assert.equal(toggle.props.disabled, true);
    await toggle.props.onValueChange(true);
    assert.equal(settingWrites.length, 0);
    resolveSettings(null);
    await save;
    assert.equal(profileWrites.length, 1);
  } finally {
    api.getOrderSettings = original;
  }
});
