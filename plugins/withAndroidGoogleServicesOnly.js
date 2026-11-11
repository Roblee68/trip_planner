const { AndroidConfig, withPlugins } = require('@expo/config-plugins');

// Google sign-in is offered on Android; leave the iOS URL scheme and plist unchanged.
module.exports = function withAndroidGoogleServicesOnly(config) {
  return withPlugins(config, [
    AndroidConfig.GoogleServices.withClassPath,
    AndroidConfig.GoogleServices.withApplyPlugin,
    AndroidConfig.GoogleServices.withGoogleServicesFile,
  ]);
};
