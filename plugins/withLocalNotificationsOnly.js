const { withEntitlementsPlist } = require('@expo/config-plugins');

// Private previews schedule local reminders only. A push-enabled build needs
// its own Apple provisioning setup and PBB_ENABLE_REMOTE_PUSH=1.
module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, current => {
    if (process.env.PBB_ENABLE_REMOTE_PUSH !== '1') delete current.modResults['aps-environment'];
    return current;
  });
};
