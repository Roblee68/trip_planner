import { createHash } from 'node:crypto';
import type { ScoutRequest, ScoutResponse } from './contracts.js';
import { distanceKm } from './selection.js';

export const DAY = 86_400_000;
export type StoredEvent = {
  id: string; title: string; summary: string; category: string; topics: string[];
  place: string; eventDate: string; eventTime: string; timeZone: string;
  startsAt: string | null; endsAt: string | null;
  priceAmount: number | null; currency: string; venue: string; address: string;
  latitude: number | null; longitude: number | null;
  sourceUrl: string; sourceName: string; sourceId: string; attribution: string;
  checkedAt: string; status: 'active' | 'cancelled';
};
export function cityKey(place: string): string {
  return place.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
export const cityId = (place: string) => createHash('sha256').update(cityKey(place)).digest('hex').slice(0, 32);
export function zoneValid(value: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return value.includes('/') || value === 'UTC'; }
  catch { return false; }
}
export function clockInZone(now: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}
export function safeEventUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 2000) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname.includes(':') ||
        !url.hostname.includes('.') || /(^|\.)(localhost|local|internal)$/.test(url.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}
const text = (value: unknown, length = 300) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, length) : '';
export function normalizeEvent(raw: Record<string, unknown>, place: string, timeZone: string, now: Date, sourceId: string): StoredEvent | null {
  const title = text(raw.title, 120), eventDate = text(raw.eventDate, 10), sourceUrl = safeEventUrl(raw.sourceUrl);
  if (!title || !sourceUrl || !zoneValid(timeZone) || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;
  const parsedDate = new Date(`${eventDate}T12:00:00Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== eventDate) return null;
  if (eventDate < clockInZone(now, timeZone).date || parsedDate.getTime() > now.getTime() + 60 * DAY) return null;
  const eventTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.eventTime)) ? String(raw.eventTime) : '';
  let startsAt: string | null = null;
  if (eventTime && typeof raw.startsAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(raw.startsAt)) {
    const stamp = new Date(raw.startsAt);
    if (Number.isFinite(stamp.getTime())) {
      const local = clockInZone(stamp, timeZone);
      if (local.date === eventDate && local.time === eventTime) startsAt = stamp.toISOString();
    }
  }
  if (eventTime && raw.startsAt && !startsAt) return null;
  let endsAt: string | null = null;
  if (startsAt && typeof raw.endsAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(raw.endsAt)) {
    const end = Date.parse(raw.endsAt);
    if (end > Date.parse(startsAt) && end - Date.parse(startsAt) <= 7 * DAY) endsAt = new Date(end).toISOString();
  }
  const latitude = typeof raw.latitude === 'number' && Math.abs(raw.latitude) <= 90 ? raw.latitude : null;
  const longitude = typeof raw.longitude === 'number' && Math.abs(raw.longitude) <= 180 ? raw.longitude : null;
  const sourceIdentity = text(raw.sourceEventId, 120) || `${title.toLowerCase()}|${sourceUrl}`;
  const id = `event-${createHash('sha256').update(`${cityKey(place)}|${sourceId}|${sourceIdentity}|${eventDate}|${eventTime}`).digest('hex').slice(0, 28)}`;
  return { id, title, summary: text(raw.summary), category: text(raw.category, 40) || 'other', topics: Array.isArray(raw.topics) ? raw.topics.map(value => text(value, 50)).filter(Boolean).slice(0, 12) : [],
    place, eventDate, eventTime, timeZone, startsAt, endsAt,
    priceAmount: typeof raw.priceAmount === 'number' && Number.isFinite(raw.priceAmount) && raw.priceAmount >= 0 ? raw.priceAmount : null,
    currency: /^[A-Z]{3}$/.test(String(raw.currency)) ? String(raw.currency) : '',
    venue: text(raw.venue, 160), address: text(raw.address, 220), latitude, longitude,
    sourceUrl, sourceName: new URL(sourceUrl).hostname.replace(/^www\./, ''), sourceId,
    attribution: text(raw.attribution, 220), checkedAt: now.toISOString(), status: raw.status === 'cancelled' ? 'cancelled' : 'active' };
}

/** All callers share source facts; preferences only affect this inexpensive local ranking. */
export function selectStoredEvents(events: StoredEvent[], request: ScoutRequest, now = new Date()): StoredEvent[] {
  const freeOnly = /\bfree\b|no cost|without spending/i.test(request.prompt);
  const searchWords = request.prompt.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 3 && !new Set(['find','experiences','experience','current','activities','activity','match','saved','interests','practical','limits','preferences','budget','travel','source','linked','options','something','interesting','prioritize','specific','that','with','near','ideas','today','plan','soon','them','your','this','have','want','more']).has(word));
  const interests = request.occasion === 'surprise' ? [] : [...request.interests, ...request.topics].map(value => value.toLowerCase());
  const scored = events.flatMap(event => {
    if (event.status !== 'active' || cityKey(event.place) !== cityKey(request.place) || !zoneValid(event.timeZone) || !safeEventUrl(event.sourceUrl) || now.getTime() - Date.parse(event.checkedAt) > 3 * DAY || Date.parse(event.checkedAt) > now.getTime() || !Number.isFinite(Date.parse(event.checkedAt))) return [];
    const today = clockInZone(now, event.timeZone).date;
    if (event.eventDate < today || event.endsAt && Date.parse(event.endsAt) <= now.getTime()) return [];
    if (freeOnly && event.priceAmount !== 0) return [];
    if (event.priceAmount !== null && (event.priceAmount !== 0 && event.currency !== request.currency || event.priceAmount > request.maxBudget)) return [];
    const measured = request.latitude !== undefined && request.longitude !== undefined && event.latitude !== null && event.longitude !== null;
    if (measured && distanceKm(request.latitude!, request.longitude!, event.latitude!, event.longitude!) > request.maxDistanceKm) return [];
    if (request.occasion === 'today') {
      // Do not present unknown closing times as a feasible time-limited outing.
      if (event.eventDate !== today || !event.startsAt || !event.endsAt || Date.parse(event.startsAt) > now.getTime() + (request.timeAvailableHours ?? 0) * 3_600_000) return [];
    }
    const haystack = `${event.title} ${event.summary} ${event.category} ${event.topics.join(' ')}`.toLowerCase();
    const score = searchWords.filter(word => haystack.includes(word)).length * 3 + interests.filter(word => haystack.includes(word)).length * 2;
    return [{ event, score }];
  });
  scored.sort((a, b) => b.score - a.score || a.event.eventDate.localeCompare(b.event.eventDate) || a.event.eventTime.localeCompare(b.event.eventTime) || a.event.id.localeCompare(b.event.id));
  if (request.refinement === 'cheaper') scored.sort((a,b) => (a.event.priceAmount ?? Infinity) - (b.event.priceAmount ?? Infinity));
  if (request.refinement === 'different' || request.occasion === 'surprise') {
    const day = now.toISOString().slice(0, 10);
    scored.sort((a,b) => createHash('sha256').update(day+a.event.id).digest('hex').localeCompare(createHash('sha256').update(day+b.event.id).digest('hex')));
  }
  return scored.slice(0, request.occasion === 'discover' ? 5 : 3).map(value => value.event);
}
export function storedScoutResponse(events: StoredEvent[], request: ScoutRequest, now = new Date()): ScoutResponse {
  const selected = selectStoredEvents(events, request, now);
  return { mode: 'live', picks: [], followUp: null,
    message: selected.length ? `Source-linked ideas from the shared ${request.place} collection. Check prices, availability and travel time with the organizer.` : `No current match in the shared ${request.place} collection yet. Try another date or interest; new listings are collected centrally.`,
    ideas: selected.map(event => ({ id: event.id, title: event.title, summary: event.summary || 'See the organizer’s listing for details.',
      reason: `${event.category}. Check travel time and any unlisted price before leaving.`, eventDate: event.eventDate,
      dateText: `${event.eventDate}${event.eventTime ? ` ${event.eventTime}` : ''} · ${event.timeZone}`,
      priceText: event.priceAmount === null ? 'Price not listed — check source' : event.priceAmount === 0 ? 'Free' : `${event.currency} ${event.priceAmount}`,
      venue: event.venue || event.place, address: event.address || null, place: event.place, sourceUrl: event.sourceUrl, foundAt: event.checkedAt,
      timeZone: event.timeZone, startsAt: event.startsAt, endsAt: event.endsAt })) };
}
