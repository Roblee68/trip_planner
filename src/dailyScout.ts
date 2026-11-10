import * as Notifications from 'expo-notifications';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Preferences } from './logic';
import { ensureScoutGuestAuth, firebaseConfig } from './remoteScout';

const projectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;
export const dailyScoutConfigured = process.env.EXPO_PUBLIC_PBB_DAILY_SCOUT === '1' && !!projectId && Object.values(firebaseConfig).every(Boolean);

async function signedInApp() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await ensureScoutGuestAuth(auth);
  return app;
}

export async function getDailyPushToken(): Promise<string> {
  if (!dailyScoutConfigured || !projectId) throw new Error('Daily scout push is not configured on this device.');
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function saveDailyScoutSubscription(enabled: boolean, preferences: Preferences, pushToken?: string): Promise<void> {
  if (!dailyScoutConfigured) throw new Error('Daily scout push is not connected yet.');
  const app = await signedInApp();
  const call = httpsCallable(getFunctions(app, 'northamerica-northeast2'), 'setDailyScout');
  await call(enabled ? {
    enabled: true, pushToken, place: preferences.place.trim(), currency: preferences.currency,
    maxBudget: preferences.maxBudget, maxDistanceKm: preferences.maxDistanceKm,
    interests: preferences.interests, topics: preferences.topics, travelModes: preferences.travelModes,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  } : { enabled: false });
}
