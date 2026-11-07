import { createHash } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { loadCandidates } from './catalog.js';
import { dailyMatches, localClock, type DailyProfile } from './dailyAlerts.js';
import type { ScoutRequest } from './contracts.js';
import { discoverWebLeads } from './webDaily.js';

type Subscription = DailyProfile & { pushToken: string; enabled: boolean };
const TOKEN = /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/;
const MODES = new Set(['walk', 'transit', 'train', 'car', 'plane', 'ferry', 'boat']);
const openaiApiKey = defineSecret('OPENAI_API_KEY');

export function parseSubscription(input: unknown): Subscription {
  if (!input || typeof input !== 'object') throw new Error('Invalid subscription');
  const data = input as Record<string, unknown>;
  const text = (key: string) => typeof data[key] === 'string' ? (data[key] as string).trim() : '';
  const strings = (key: string, limit: number) => Array.isArray(data[key]) ? (data[key] as unknown[]).filter((value): value is string => typeof value === 'string' && value.length <= 50).slice(0, limit) : [];
  const profile: Subscription = {
    enabled: data.enabled === true,
    pushToken: text('pushToken'), place: text('place'), currency: text('currency').toUpperCase(),
    maxBudget: Number(data.maxBudget), maxDistanceKm: Number(data.maxDistanceKm),
    interests: strings('interests', 12), topics: strings('topics', 80),
    travelModes: strings('travelModes', 7).filter(mode => MODES.has(mode)), timeZone: text('timeZone'),
  };
  try { new Intl.DateTimeFormat('en-US', { timeZone: profile.timeZone }); }
  catch { throw new Error('Invalid time zone'); }
  if (!profile.enabled || !TOKEN.test(profile.pushToken) || profile.place.length < 3 || profile.place.length > 120 ||
    !/^[A-Z]{3}$/.test(profile.currency) || !Number.isFinite(profile.maxBudget) || profile.maxBudget < 0 || profile.maxBudget > 10000 ||
    !Number.isFinite(profile.maxDistanceKm) || profile.maxDistanceKm < 0 || profile.maxDistanceKm > 500) throw new Error('Invalid subscription');
  return profile;
}

export async function saveDailyScout(uid: string, value: unknown): Promise<{ enabled: boolean }> {
  if (!value || typeof value !== 'object') throw new HttpsError('invalid-argument', 'Check the daily scout settings.');
  const data = value as Record<string, unknown>;
  const ref = getFirestore().collection('scoutSubscriptions').doc(uid);
  if (data.enabled === false) { await ref.delete(); return { enabled: false }; }
  let profile: Subscription;
  try { profile = parseSubscription(data); }
  catch { throw new HttpsError('invalid-argument', 'Check the daily scout settings.'); }
  await ref.set({ ...profile, updatedAt: new Date().toISOString() });
  return { enabled: true };
}

async function sendPush(to: string, title: string, body: string, sourceUrl: string, eventId: string): Promise<string> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to, title, body, data: { sourceUrl, eventId } }),
  });
  if (!response.ok) throw new Error(`Expo push returned HTTP ${response.status}`);
  const result = await response.json() as { data?: { status: string; id?: string; message?: string } };
  if (result.data?.status !== 'ok' || !result.data.id) throw new Error(result.data?.message || 'Expo push did not accept the notification');
  return result.data.id;
}

async function scanSubscriber(uid: string, profile: Subscription, now: Date): Promise<void> {
  if (!profile.enabled || !TOKEN.test(profile.pushToken)) return;
  const local = localClock(now, profile.timeZone);
  if (local.hour !== 8) return;
  const webMode = process.env.PBB_DISCOVERY_MODE === 'web';
  const matches = webMode ? (await discoverWebLeads(profile, now)).map(match => ({
    eventId: createHash('sha256').update(match.lead.sourceUrl).digest('hex'), title: match.lead.title,
    sourceUrl: match.lead.sourceUrl, startsAt: match.lead.startsAt, kind: match.kind,
  })) : await (async () => {
    const request: ScoutRequest = { ...profile, prompt: 'daily matches', refinement: 'balanced' };
    return dailyMatches(await loadCandidates(request), profile, now).map(match => ({
      eventId: match.item.id, title: match.item.title, sourceUrl: match.item.sourceUrl!,
      startsAt: match.item.startsAt, kind: match.kind,
    }));
  })();
  let sent = 0;
  for (const match of matches) {
    if (sent >= 2) break;
    const id = createHash('sha256').update(`${uid}\0${match.eventId}\0${match.startsAt}\0${match.kind}`).digest('hex');
    const ref = getFirestore().collection('scoutNotifications').doc(id);
    const reserved = await getFirestore().runTransaction(async transaction => {
      const previous = await transaction.get(ref);
      if (previous.exists && previous.get('status') !== 'failed') return false;
      transaction.set(ref, { uid, eventId: match.eventId, kind: match.kind, status: 'reserved', sourceUrl: match.sourceUrl, discoveryMode: webMode ? 'web' : 'catalog', createdAt: now.toISOString() });
      return true;
    });
    if (!reserved) continue;
    const title = webMode ? `Possible ${match.kind === 'signup' ? 'sign-up' : 'weekend'} idea: ${match.title}` : match.kind === 'signup' ? `Sign-up coming up: ${match.title}` : `A weekend idea: ${match.title}`;
    const body = webMode ? 'A public source suggests a match. Tap to check the date, cost, availability and weather before making plans.' : match.kind === 'signup' ? 'The listed deadline is near. Check the organizer source before signing up.' : 'This matches your interests. Confirm the time, availability and weather before leaving.';
    try {
      const ticketId = await sendPush(profile.pushToken, title, body, match.sourceUrl, match.eventId);
      await ref.update({ status: 'ticket', ticketId, pushToken: profile.pushToken, submittedAt: new Date().toISOString() });
      sent += 1;
    } catch (error) {
      await ref.update({ status: 'failed', error: error instanceof Error ? error.message.slice(0, 180) : 'Unknown push error' });
      console.error('Daily scout push failed', { uid, eventId: match.eventId, error });
    }
  }
}

async function checkPushReceipts(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - 15 * 60_000).toISOString();
  const snapshot = await getFirestore().collection('scoutNotifications').where('status', '==', 'ticket').where('submittedAt', '<=', cutoff).limit(100).get();
  if (snapshot.empty) return;
  const ids = snapshot.docs.map(doc => doc.get('ticketId')).filter((value): value is string => typeof value === 'string');
  if (!ids.length) return;
  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
  if (!response.ok) throw new Error(`Expo receipts returned HTTP ${response.status}`);
  const result = await response.json() as { data?: Record<string, { status: string; details?: { error?: string }; message?: string }> };
  for (const doc of snapshot.docs) {
    const receipt = result.data?.[doc.get('ticketId')];
    if (!receipt) {
      if (Date.parse(doc.get('submittedAt')) < now.getTime() - 24 * 60 * 60_000) {
        await doc.ref.update({ status: 'receiptUnavailable', receiptCheckedAt: now.toISOString() });
      }
      continue;
    }
    await doc.ref.update({ status: receipt.status === 'ok' ? 'providerAccepted' : 'deliveryError', receiptError: receipt.details?.error ?? receipt.message ?? null, receiptCheckedAt: now.toISOString() });
    if (receipt.details?.error === 'DeviceNotRegistered') {
      const user = getFirestore().collection('scoutSubscriptions').doc(doc.get('uid'));
      await getFirestore().runTransaction(async transaction => {
        const current = await transaction.get(user);
        if (current.get('pushToken') === doc.get('pushToken')) transaction.delete(user);
      });
    }
  }
}

export const dailyOpportunityScan = onSchedule({ schedule: '0 * * * *', timeZone: 'UTC', region: 'northamerica-northeast2', timeoutSeconds: 540, memory: '512MiB', maxInstances: 1, secrets: [openaiApiKey] }, async () => {
  const now = new Date();
  await checkPushReceipts(now);
  if (process.env.PBB_DISCOVERY_MODE === 'web' ? !openaiApiKey.value() : process.env.PBB_CATALOG_MODE !== 'firestore') return;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let query = getFirestore().collection('scoutSubscriptions').where('enabled', '==', true).orderBy('__name__').limit(50);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      try { await scanSubscriber(doc.id, doc.data() as Subscription, now); }
      catch (error) { console.error('Daily scout scan failed', { uid: doc.id, error }); }
    }
    cursor = page.docs.at(-1);
    if (page.size < 50) break;
  }
});
