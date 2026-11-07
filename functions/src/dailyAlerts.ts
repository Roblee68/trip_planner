import type { Candidate } from './contracts.js';

export type DailyProfile = {
  place: string;
  currency: string;
  maxBudget: number;
  maxDistanceKm: number;
  interests: string[];
  topics: string[];
  travelModes: string[];
  timeZone: string;
};
export type DailyMatch = { item: Candidate; kind: 'signup' | 'weekend'; priority: number };
const DAY = 86_400_000;

export function localClock(now: Date, timeZone: string): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return { day: `${value('year')}-${value('month')}-${value('day')}`, hour: Number(value('hour')) };
}

export function dailyMatches(items: Candidate[], profile: DailyProfile, now = new Date()): DailyMatch[] {
  const selected = profile.topics.filter(topic => topic !== 'Open to new ideas');
  const matches: DailyMatch[] = [];
  for (const item of items) {
    const start = Date.parse(item.startsAt);
    const checked = item.verifiedAt ? Date.parse(item.verifiedAt) : NaN;
    if (item.mode !== 'live' || item.status !== 'active' || !item.sourceUrl?.startsWith('https://') ||
      !Number.isFinite(start) || start <= now.getTime() || start > now.getTime() + 14 * DAY ||
      !Number.isFinite(checked) || checked > now.getTime() || now.getTime() - checked > DAY ||
      item.currency !== profile.currency || item.totalCost > profile.maxBudget || item.distanceKm > profile.maxDistanceKm ||
      item.place.trim().toLowerCase() !== profile.place.trim().toLowerCase() ||
      (item.travelModes?.length && !item.travelModes.some(mode => profile.travelModes.includes(mode)))) continue;
    const matchedTopics = item.topics?.filter(topic => selected.includes(topic)).length ?? 0;
    const categoryMatch = profile.interests.includes(item.category);
    if (!categoryMatch && !matchedTopics) continue;
    const score = (matchedTopics ? 30 : 0) + (categoryMatch ? 20 : 0) + (item.totalCost === 0 ? 5 : 0) + Math.max(0, 10 - item.distanceKm / 10);
    const deadline = item.signupBy ? Date.parse(item.signupBy) : NaN;
    const signupSoon = Number.isFinite(deadline) && deadline > now.getTime() && deadline <= now.getTime() + 7 * DAY;
    if (signupSoon) {
      matches.push({ item, kind: 'signup', priority: score + 40 });
    }
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: profile.timeZone, weekday: 'short' }).format(new Date(start));
    if (!signupSoon && (weekday === 'Sat' || weekday === 'Sun') && start <= now.getTime() + 7 * DAY) {
      matches.push({ item, kind: 'weekend', priority: score + 20 });
    }
  }
  return matches.sort((a, b) => b.priority - a.priority || a.item.startsAt.localeCompare(b.item.startsAt));
}
