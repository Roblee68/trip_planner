const { withPodfile } = require('@expo/config-plugins');

// Keep native generation compatible with Xcode 27 and the PB&B folder name.
module.exports = function withPodMinimum(config) {
  return withPodfile(config, current => {
    const marker = 'PB&B CocoaPods compatibility';
    if (current.modResults.contents.includes(marker)) return current;
    const postInstall = /(    react_native_post_install\([\s\S]*?\n    \)\n)/;
    if (!postInstall.test(current.modResults.contents)) {
      throw new Error('Could not locate React Native post_install in generated Podfile');
    }
    current.modResults.contents = current.modResults.contents.replace(postInstall, `$1
    # ${marker}: Xcode 27 rejects AsyncStorage's older resource target.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        version = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if version && Gem::Version.new(version) < Gem::Version.new('16.4')
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'
        end
      end
      # ExpoConstants' nested bash -c treats the ampersand in PB&B as shell syntax.
      if target.name == 'EXConstants'
        target.shell_script_build_phases.each do |phase|
          if phase.name == '[CP-User] Generate app.config for prebuilt Constants.manifest'
            phase.shell_script = 'bash -l "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"'
          end
        end
      end
    end
`);
    return current;
  });
};
