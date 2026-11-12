import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { safeEventUrl } from './eventRecords.js';

export const ORGANIZER_IMAGE_PERMISSION_VERSION = '2026-11-12-v1';
const MAX_PER_DAY = 3;
const MAX_PER_DOMAIN_PER_DAY = 10;
const provinces = new Set(['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Québec', 'Saskatchewan', 'Yukon']);
const text = (value: unknown, max: number): string => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const validDate = (raw: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(`${raw}T12:00:00Z`)) && new Date(`${raw}T12:00:00Z`).toISOString().slice(0, 10) === raw;
const personalEmailDomains = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.ca', 'outlook.com', 'hotmail.com', 'hotmail.ca', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com']);

export function parseOrganizerSubmission(data: unknown, now = new Date()) {
  if (!data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Complete the event form.');
  const raw = data as Record<string, unknown>;
  const organizer = text(raw.organizer, 140);
  const legalBusinessName = text(raw.legalBusinessName, 160);
  const businessAddress = text(raw.businessAddress, 240);
  const businessPhone = text(raw.businessPhone, 40);
  const registrationNumber = text(raw.registrationNumber, 80);
  const contactName = text(raw.contactName, 100);
  const websiteUrl = safeEventUrl(raw.websiteUrl);
  const eventUrl = safeEventUrl(raw.eventUrl);
  const title = text(raw.title, 140);
  const description = text(raw.description, 1200);
  const city = text(raw.city, 100);
  const province = text(raw.province, 60);
  const venue = text(raw.venue, 160);
  const address = text(raw.address, 220);
  const eventDate = text(raw.eventDate, 10);
  const eventTime = text(raw.eventTime, 5);
  const price = text(raw.price, 80);
  if (!Array.isArray(raw.imageUrls) || raw.imageUrls.length > 3) throw new HttpsError('invalid-argument', 'Provide up to three valid HTTPS image links.');
  const imageUrls = raw.imageUrls.filter(value => typeof value === 'string' && value.trim()).map(value => safeEventUrl(value));
  if (!organizer || !legalBusinessName || !businessAddress || !businessPhone || !contactName || !websiteUrl || !eventUrl || !title || !description || !city || !province || !venue || !address || !price) throw new HttpsError('invalid-argument', 'Complete the required event details and official HTTPS links.');
  if (!provinces.has(province)) throw new HttpsError('invalid-argument', 'Choose a Canadian province or territory.');
  if (!validDate(eventDate) || eventDate < now.toISOString().slice(0, 10) || eventDate > new Date(now.getTime() + 366 * 86_400_000).toISOString().slice(0, 10)) throw new HttpsError('invalid-argument', 'Choose an event date within the next year.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime)) throw new HttpsError('invalid-argument', 'Enter the local event start time.');
  if (!Array.isArray(raw.imageUrls) || raw.imageUrls.length > 3 || imageUrls.some(url => !url)) throw new HttpsError('invalid-argument', 'Provide up to three valid HTTPS image links.');
  if (raw.authorized !== true) throw new HttpsError('invalid-argument', 'Confirm you are authorized to submit this event.');
  if (imageUrls.length && (raw.imagePermission !== true || raw.imagePermissionVersion !== ORGANIZER_IMAGE_PERMISSION_VERSION)) throw new HttpsError('invalid-argument', 'Confirm the current image permission before submitting images.');
  const promotionInterest = raw.promotionInterest === 'now' ? 'now' : raw.promotionInterest === 'later' ? 'later' : 'none';
  return { organizer, legalBusinessName, businessAddress, businessPhone, registrationNumber, contactName, websiteUrl, eventUrl, title, description, city, province, venue, address, eventDate, eventTime, price, imageUrls,
    imagePermission: imageUrls.length > 0, imagePermissionVersion: imageUrls.length ? ORGANIZER_IMAGE_PERMISSION_VERSION : null,
    promotionInterest, marketingConsent: raw.marketingConsent === true };
}

export const submitOrganizerEvent = onCall({ region: 'northamerica-northeast2', invoker: 'public', maxInstances: 2 }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in and verify your business email first.');
  const account = await getAuth().getUser(request.auth.uid);
  const email = account.email?.trim().toLowerCase() || '';
  const emailDomain = email.split('@')[1] || '';
  if (!account.emailVerified || !emailDomain || personalEmailDomains.has(emailDomain)) throw new HttpsError('permission-denied', 'Use a verified business email address to submit an event.');
  const submission = parseOrganizerSubmission(request.data);
  const websiteHost = new URL(submission.websiteUrl).hostname.replace(/^www\./, '').toLowerCase();
  const businessDomainMatchesWebsite = websiteHost === emailDomain || websiteHost.endsWith(`.${emailDomain}`) || emailDomain.endsWith(`.${websiteHost}`);
  const db = getFirestore();
  const dateKey = new Date().toISOString().slice(0, 10);
  const limitRef = db.collection('organizerSubmissionLimits').doc(`${request.auth.uid}_${dateKey}`);
  const domainLimitRef = db.collection('organizerSubmissionLimits').doc(`domain_${emailDomain}_${dateKey}`);
  const submissionRef = db.collection('organizerEventSubmissions').doc();
  await db.runTransaction(async transaction => {
    const prior = await transaction.get(limitRef);
    const domainPrior = await transaction.get(domainLimitRef);
    const domainCount = typeof domainPrior.get('count') === 'number' ? domainPrior.get('count') as number : 0;
    if (domainCount >= MAX_PER_DOMAIN_PER_DAY) throw new HttpsError('resource-exhausted', 'This business has reached today’s submission limit.');
    const count = typeof prior.get('count') === 'number' ? prior.get('count') as number : 0;
    if (count >= MAX_PER_DAY) throw new HttpsError('resource-exhausted', 'You have reached today’s event submission limit.');
    transaction.set(limitRef, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(domainLimitRef, { count: domainCount + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.create(submissionRef, { ...submission, uid: request.auth!.uid, email, emailDomain, businessDomainMatchesWebsite, status: 'pendingReview', submittedAt: FieldValue.serverTimestamp(), reviewedAt: null, reviewedBy: null,
      publishedEventId: null, consentRecordedAt: FieldValue.serverTimestamp() });
  });
  return { submissionId: submissionRef.id, status: 'pendingReview' };
});
