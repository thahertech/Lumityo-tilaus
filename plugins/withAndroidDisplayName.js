const { AndroidConfig, withStringsXml } = require('expo/config-plugins');

module.exports = (config) => withStringsXml(config, (mod) => {
  mod.modResults = AndroidConfig.Strings.setStringItem([
    AndroidConfig.Resources.buildResourceItem({ name: 'app_name', value: 'Lumityöt' }),
  ], mod.modResults);
  return mod;
});
