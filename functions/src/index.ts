import { initializeApp } from 'firebase-admin/app';
import { reservePaidAction, readAllowance } from './paidBudget.js';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { catalogueScout, catalogueWeekly, refreshRequestedCities } from './eventStore.js';
import { cachedRouteScout } from './scoutCache.js';
import { loadCandidates } from './catalog.js';
import { parseScoutRequest } from './selection.js';
import { scout } from './scout.js';
import { scoutWeb } from './webScout.js';
import { parseImportScanInput, scanImportedFind } from './importScan.js';
import { dailyOpportunityScan, saveDailyScout } from './dailyService.js';
import { weeklyFeaturedAdventures } from './featuredAdventures.js';
import { parseWeeklyLocalPlace } from './weeklyLocalEvents.js';
export { deleteAccount } from './accountDeletion.js';

initializeApp();
const openaiApiKey = defineSecret('OPENAI_API_KEY');

export const suggestExperiences = onCall({ region: 'northamerica-northeast2', invoker: 'public', secrets: [openaiApiKey], timeoutSeconds: 150, memory: '512MiB', maxInstances: 1 }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in before using the scout.');
  if (request.data?.mode === 'allowance') return readAllowance(request.auth.uid);
  if (!openaiApiKey.value()) throw new HttpsError('failed-precondition', 'The scout is not configured yet.');
  if (request.data?.mode === 'import') {
    let importInput;
    try { importInput = parseImportScanInput(request.data); }
    catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Choose a screenshot or public link.'); }
    await reservePaidAction(request.auth.uid);
    try { return await scanImportedFind(importInput); }
    catch (error) {
      console.error('Shared find scan failed', error);
      throw new HttpsError('internal', 'The scout could not read this find. You can enter its details yourself.');
    }
  }
  let input;
  try { input = parseScoutRequest(request.data); }
  catch { throw new HttpsError('invalid-argument', 'Please check the request and location.'); }
  try {
    if (input.occasion === 'route') return await cachedRouteScout(request.auth.uid,input,async()=>{await reservePaidAction(request.auth!.uid);return scoutWeb(input);});
    if (process.env.PBB_SCOUT_MODE !== 'legacy') return await catalogueScout(input,request.auth.uid);
    await reservePaidAction(request.auth.uid);
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

export const getWeeklyFeaturedAdventures = onCall({ region: 'northamerica-northeast2', invoker: 'public', secrets: [openaiApiKey], timeoutSeconds: 120, memory: '512MiB', maxInstances: 1 }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in before viewing featured adventures.');
  if (!openaiApiKey.value()) throw new HttpsError('failed-precondition', 'The adventure scout is not configured yet.');
  try { return await weeklyFeaturedAdventures(); }
  catch (error) {
    console.error('Weekly featured adventure refresh failed', error);
    throw new HttpsError('internal', 'Weekly adventures could not be refreshed. Please try again later.');
  }
});

export const getWeeklyLocalEvents = onCall({ region: 'northamerica-northeast2', invoker: 'public', secrets: [openaiApiKey], timeoutSeconds: 120, memory: '512MiB', maxInstances: 1 }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in before viewing the weekly list.');
  if (!openaiApiKey.value()) throw new HttpsError('failed-precondition', 'The weekly list is not configured yet.');
  let place: string;
  try { place = parseWeeklyLocalPlace(request.data?.place); }
  catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Choose a city and country.'); }
  try { return await catalogueWeekly(place, request.auth.uid); }
  catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Weekly local events refresh failed', error);
    throw new HttpsError('internal', 'This week’s list could not be updated. Try again later.');
  }
});

export { dailyOpportunityScan };

export const refreshEventCatalogue = onSchedule({schedule:'every 30 minutes',timeZone:'UTC',region:'northamerica-northeast2',timeoutSeconds:540,memory:'1GiB',maxInstances:1,secrets:[openaiApiKey]},refreshRequestedCities);
