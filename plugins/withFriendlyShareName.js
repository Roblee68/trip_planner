const fs = require('node:fs/promises');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

module.exports = function withFriendlyShareName(config) {
  return withDangerousMod(config, ['ios', async (config) => {
    const infoPlist = path.join(config.modRequest.platformProjectRoot, 'expo-sharing-extension', 'Info.plist');
    const original = await fs.readFile(infoPlist, 'utf8');
    const currentName = '<key>CFBundleDisplayName</key>\n    <string>$(PRODUCT_NAME)</string>';
    if (!original.includes(currentName)) throw new Error('Could not find the share extension display name.');
    await fs.writeFile(infoPlist, original.replace(currentName, '<key>CFBundleDisplayName</key>\n    <string>Save to Detours &amp; Escapades</string>'));
    return config;
  }]);
};
