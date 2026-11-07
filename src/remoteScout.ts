import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Category, Experience, Preferences } from './logic';

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
type ScoutResponse = { message: string; picks: Pick[]; followUp: string | null; mode: 'sample' | 'live' | 'web'; citations?: ScoutCitation[] };

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

export async function askRemoteScout(prompt: string, preferences: Preferences, refinement: 'balanced' | 'different' | 'cheaper' | 'closer'): Promise<ScoutResponse> {
  if (!remoteScoutConfigured) throw new Error('The agent connection is not configured on this device.');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  const call = httpsCallable(getFunctions(app, 'northamerica-northeast2'), 'suggestExperiences');
  const response = await call({
    prompt: prompt.trim() || 'Find an interesting experience for me',
    place: preferences.place.trim(), currency: preferences.currency.trim().toUpperCase(),
    maxBudget: preferences.maxBudget, maxDistanceKm: preferences.maxDistanceKm,
    interests: preferences.interests, topics: preferences.topics, travelModes: preferences.travelModes, refinement,
  });
  return response.data as ScoutResponse;
}
