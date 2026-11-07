import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import type { ReminderPlan } from './reminders.ts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function phoneAlertsAllowed(): Promise<boolean> {
  const status = await Notifications.getPermissionsAsync();
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function requestPhoneAlerts(): Promise<boolean> {
  if (await phoneAlertsAllowed()) return true;
  const status = await Notifications.requestPermissionsAsync();
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

let syncQueue = Promise.resolve();
export function syncPhoneReminders(plans: ReminderPlan[]): Promise<void> {
  const work = async () => {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const own = existing.filter(request => typeof request.content.data?.pbbReminderKey === 'string');
    const desired = new Map(plans.map(plan => [plan.key, plan]));
    for (const request of own) {
      if (!desired.has(String(request.content.data?.pbbReminderKey))) await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
    const current = new Set(own.map(request => String(request.content.data?.pbbReminderKey)));
    for (const plan of plans) {
      if (current.has(plan.key)) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: plan.title, body: plan.body, data: { pbbReminderKey: plan.key, itemId: plan.itemId, sourceUrl: plan.sourceUrl } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(plan.at) },
      });
    }
  };
  syncQueue = syncQueue.then(work, work);
  return syncQueue;
}

export async function sendSampleAlert(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'PB&B preview alert', body: 'A dance class that fits your interests could be starting soon. This is a sample, not a verified event.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
}

export function listenForSourceTaps(): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const sourceUrl = response.notification.request.content.data?.sourceUrl;
    if (typeof sourceUrl === 'string' && sourceUrl.startsWith('https://')) void Linking.openURL(sourceUrl);
  });
}
