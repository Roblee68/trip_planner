import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { loadCandidates } from './catalog.js';
import { parseScoutRequest } from './selection.js';
import { scout } from './scout.js';
import { scoutWeb } from './webScout.js';
import { dailyOpportunityScan, saveDailyScout } from './dailyService.js';

initializeApp();
const openaiApiKey = defineSecret('OPENAI_API_KEY');

async function checkDailyLimit(uid: string) {
  const day = new Date().toISOString().slice(0, 10);
  const usage = getFirestore().collection('agentUsage');
  const ref = usage.doc(`${uid}_${day}`);
  const globalRef = usage.doc(`global_${day}`);
  await getFirestore().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const globalSnapshot = await transaction.get(globalRef);
    const count = Number(snapshot.data()?.count ?? 0);
    const globalCount = Number(globalSnapshot.data()?.count ?? 0);
    if (count >= 30) throw new HttpsError('resource-exhausted', 'Daily scout limit reached. Please try tomorrow.');
    if (globalCount >= 40) throw new HttpsError('resource-exhausted', 'The scout is at its preview limit for today. Please try tomorrow.');
    transaction.set(ref, { count: count + 1, updatedAt: new Date().toISOString() }, { merge: true });
    transaction.set(globalRef, { count: globalCount + 1, updatedAt: new Date().toISOString() }, { merge: true });
  });
}

export const suggestExperiences = onCall({ region: 'northamerica-northeast2', secrets: [openaiApiKey], timeoutSeconds: 90, memory: '512MiB', maxInstances: 1 }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in before using the scout.');
  if (!openaiApiKey.value()) throw new HttpsError('failed-precondition', 'The scout is not configured yet.');
  let input;
  try { input = parseScoutRequest(request.data); }
  catch { throw new HttpsError('invalid-argument', 'Please check the request and location.'); }
  await checkDailyLimit(request.auth.uid);
  try {
    if (process.env.PBB_SCOUT_MODE === 'web') return await scoutWeb(input);
    const candidates = await loadCandidates(input);
    return await scout(input, candidates);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Scout failed', error);
    throw new HttpsError('internal', 'The scout could not complete this search. Please try again.');
  }
});

export const setDailyScout = onCall({ region: 'northamerica-northeast2' }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in before changing daily alerts.');
  return saveDailyScout(request.auth.uid, request.data);
});

export { dailyOpportunityScan };
