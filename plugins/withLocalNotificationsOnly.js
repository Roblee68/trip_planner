const { withEntitlementsPlist } = require('@expo/config-plugins');

// This preview schedules local reminders only. Remote push will need its own
// provisioning setup when the live feed and push delivery service are ready.
module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, current => {
    delete current.modResults['aps-environment'];
    return current;
  });
};
