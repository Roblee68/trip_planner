import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Category, Experience, Preferences } from './logic';
import type { ExtractedFind } from './importedFinds';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export const remoteScoutConfigured = process.env.EXPO_PUBLIC_PBB_REMOTE_SCOUT === '1' && Object.values(firebaseConfig).every(Boolean);
const validCategories: Category[] = ['Dance', 'Outdoors', 'Arts', 'Food', 'Learning', 'Wellness'];

type Pick = {
  id: string; title: string; category: string; summary: string; listedAt: string; startsAt: string; signupBy?: string | null; status?: 'active' | 'full' | 'cancelled';
  durationHours: number; totalCost: number; currency: string; distanceKm: number;
  location: string; place: string; sourceUrl: string | null; verifiedAt: string | null;
  mode: 'sample' | 'live'; reason: string;
};
export type ScoutCitation = { startIndex: number; endIndex: number; url: string; title: string };
export type WebIdea = { id: string; title: string; summary: string; reason: string; dateText: string; eventDate?: string; priceText: string; venue: string; address: string | null; place: string; sourceUrl: string; foundAt: string };
export type WeeklyFeaturedAdventure = { id: string; title: string; summary: string; place: string; timing: string; price: string; sourceUrl: string; sourceName: string; imageUrl: string };
export type WeeklyFeaturedResponse = { adventures: WeeklyFeaturedAdventure[]; checkedAt: string | null; expiresAt: string | null; refreshing?: boolean };
export type WeeklyLocalEvent = { id: string; title: string; eventDate: string; eventTime: string; category: 'classes' | 'outdoors' | 'theatre' | 'music' | 'community' | 'arts' | 'food' | 'sports' | 'markets' | 'other'; place: string; sourceUrl: string; sourceName: string };
export type WeeklyLocalResponse = { place: string; events: WeeklyLocalEvent[]; checkedAt: string | null; expiresAt: string | null; refreshing?: boolean };
type ScoutResponse = { message: string; picks: Pick[]; followUp: string | null; mode: 'sample' | 'live' | 'web'; citations?: ScoutCitation[]; ideas?: WebIdea[] };

export function pickToExperience(pick: Pick): Experience {
  const category: Category = validCategories.includes(pick.category as Category) ? pick.category as Category : 'Learning';
  return {
    id: pick.id, title: pick.title, category, summary: pick.summary, startsAt: pick.startsAt, signupBy: pick.signupBy ?? undefined, status: pick.status,
    durationHours: pick.durationHours, totalCost: pick.totalCost, currency: pick.currency,
    distanceKm: pick.distanceKm, location: pick.location, place: pick.place, sourceUrl: pick.sourceUrl ?? undefined,
    verifiedAt: pick.verifiedAt ?? undefined, mode: pick.mode, listedAt: pick.listedAt,
    format: 'Experience', tags: [], alongWay: false, accent: '#18B8B0',
  };
}

export type RouteSearch = { destination: string; style: 'highway' | 'towns' | 'either'; via: string; detourMinutes: number; timing: 'today' | 'weekend' | 'flexible' };
export async function askRemoteScout(prompt: string, preferences: Preferences, refinement: 'balanced' | 'different' | 'cheaper' | 'closer', todayHours?: number, route?: RouteSearch, surprise = false, likedExamples: string[] = []): Promise<ScoutResponse> {
  if (!remoteScoutConfigured) throw new Error('The agent connection is not configured on this device.');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  const call = httpsCallable(getFunctions(app, 'northamerica-northeast2'), 'suggestExperiences');
  const localNow = new Date();
  const localDate = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`;
  const localTime = `${String(localNow.getHours()).padStart(2, '0')}:${String(localNow.getMinutes()).padStart(2, '0')}`;
  const response = await call({
    prompt: prompt.trim() || 'Find an interesting experience for me',
    place: preferences.place.trim(), currency: preferences.currency.trim().toUpperCase(),
    maxBudget: preferences.maxBudget, maxDistanceKm: preferences.maxDistanceKm,
    interests: preferences.interests, topics: preferences.topics, travelModes: preferences.travelModes, refinement,
    likedExamples: surprise ? [] : likedExamples.slice(0, 12),
    occasion: route ? 'route' : todayHours ? 'today' : surprise ? 'surprise' : 'any',
    localDate: todayHours || route?.timing === 'today' ? localDate : undefined,
    localTime: todayHours || route?.timing === 'today' ? localTime : undefined,
    timeAvailableHours: todayHours,
    routeDestination: route?.destination.trim(), routeStyle: route?.style, routeVia: route?.via.trim(),
    detourMinutes: route?.detourMinutes, routeTiming: route?.timing,
  });
  return response.data as ScoutResponse;
}

export type SharedFindScan = { finds: ExtractedFind[]; webLookup: 'matched' | 'no-match' | 'failed' | 'no-clues' | 'not-requested' };
export async function getWeeklyFeaturedAdventures(): Promise<WeeklyFeaturedResponse> {
  if (!remoteScoutConfigured) throw new Error('The live scout is not connected on this device.');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  const call = httpsCallable<Record<string, never>, WeeklyFeaturedResponse>(getFunctions(app, 'northamerica-northeast2'), 'getWeeklyFeaturedAdventures');
  const result = await call({});
  return result.data;
}
export async function getWeeklyLocalEvents(place: string): Promise<WeeklyLocalResponse> {
  if (!remoteScoutConfigured) throw new Error('The live scout is not connected on this device.');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  const call = httpsCallable<{ place: string }, WeeklyLocalResponse>(getFunctions(app, 'northamerica-northeast2'), 'getWeeklyLocalEvents');
  const result = await call({ place: place.trim() });
  return result.data;
}
export async function scanSharedFind(input: { imageBase64?: string; imageMime?: 'image/jpeg' | 'image/png'; sourceUrl?: string; place: string; lookupMode?: 'extract' | 'selected'; selectedFinds?: ExtractedFind[] }): Promise<SharedFindScan> {
  if (!remoteScoutConfigured) throw new Error('The live scout is not connected on this device. You can enter the details yourself.');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  const call = httpsCallable<typeof input & { mode: 'import' }, SharedFindScan>(getFunctions(app, 'northamerica-northeast2'), 'suggestExperiences');
  const result = await call({ ...input, mode: 'import' });
  return { finds: Array.isArray(result.data?.finds) ? result.data.finds : [], webLookup: result.data?.webLookup ?? 'failed' };
}
