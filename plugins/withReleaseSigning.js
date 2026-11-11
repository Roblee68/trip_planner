const { withAppBuildGradle } = require('@expo/config-plugins');
// Store builds must use the owner's upload key through Android Studio's signing wizard.
// The explicit preview flag keeps local phone builds compatible with their debug certificate.
module.exports = config => withAppBuildGradle(config, mod => {
  mod.modResults.contents = mod.modResults.contents.replace(
    /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    "$1if (findProperty('pbbPreviewSigning') == 'true') signingConfig signingConfigs.debug"
  );
  return mod;
});
