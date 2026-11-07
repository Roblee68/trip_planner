export type Category = 'Dance' | 'Outdoors' | 'Arts' | 'Food' | 'Learning' | 'Wellness';
export type Experience = {
  id: string;
  title: string;
  category: Category;
  format: string;
  summary: string;
  location: string;
  distanceKm: number;
  totalCost: number;
  durationHours: number;
  startsAt: string;
  listedAt: string;
  tags: string[];
  alongWay: boolean;
  accent: string;
  sourceUrl?: string;
  verifiedAt?: string;
  currency?: string;
  mode?: 'sample' | 'live';
};
export type Feedback = Record<string, 'love' | 'pass'>;
export type Preferences = {
  interests: Category[];
  place: string;
  currency: string;
  maxBudget: number;
  maxDistanceKm: number;
  alertsEnabled: boolean;
  freeAlerts: boolean;
  savedAlerts: boolean;
};

export const categories: Category[] = ['Dance', 'Outdoors', 'Arts', 'Food', 'Learning', 'Wellness'];

export const defaultPreferences: Preferences = {
  interests: ['Dance', 'Arts', 'Outdoors'],
  place: '',
  currency: 'CAD',
  maxBudget: 100,
  maxDistanceKm: 30,
  alertsEnabled: true,
  freeAlerts: true,
  savedAlerts: true,
};

export function daysFromNow(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function daysUntil(date: string, now = new Date()): number {
  return Math.ceil((new Date(date).getTime() - now.getTime()) / 86_400_000);
}

export function withinLimits(item: Experience, preferences: Preferences): boolean {
  return (item.currency ?? 'CAD') === preferences.currency && item.totalCost <= preferences.maxBudget && item.distanceKm <= preferences.maxDistanceKm;
}

export function score(item: Experience, preferences: Preferences, feedback: Feedback, savedIds: string[], items: Experience[] = []): number {
  const interests = preferences.interests.includes(item.category) ? 35 : 5;
  const practical = withinLimits(item, preferences) ? 25 : -50;
  const free = item.totalCost === 0 ? 8 : 0;
  const soon = daysUntil(item.startsAt) <= 14 ? 9 : 0;
  const categoryFeedback = items.filter(other => other.category === item.category && other.id !== item.id);
  const love = categoryFeedback.filter(other => feedback[other.id] === 'love').length;
  const pass = categoryFeedback.filter(other => feedback[other.id] === 'pass').length;
  const preferenceSignal = love * 12 - pass * 12;
  const saved = savedIds.includes(item.id) ? 6 : 0;
  return interests + practical + free + soon + preferenceSignal + saved;
}

export function rankExperiences(items: Experience[], preferences: Preferences, feedback: Feedback, savedIds: string[]): Experience[] {
  return items
    .filter(item => withinLimits(item, preferences) && feedback[item.id] !== 'pass' && daysUntil(item.startsAt) >= 0)
    .sort((a, b) => score(b, preferences, feedback, savedIds, items) - score(a, preferences, feedback, savedIds, items));
}

export type OpportunityAlert = {
  item: Experience;
  reason: string;
  priority: number;
};

export function opportunityAlerts(items: Experience[], preferences: Preferences, feedback: Feedback, savedIds: string[], now = new Date()): OpportunityAlert[] {
  if (!preferences.alertsEnabled) return [];
  return items.flatMap(item => {
    const days = daysUntil(item.startsAt, now);
    const age = (now.getTime() - new Date(item.listedAt).getTime()) / 86_400_000;
    const verificationAge = item.verifiedAt ? (now.getTime() - new Date(item.verifiedAt).getTime()) / 86_400_000 : Infinity;
    const watched = preferences.savedAlerts && savedIds.includes(item.id);
    const relevant = preferences.interests.includes(item.category) || watched;
    if (!relevant || !withinLimits(item, preferences) || feedback[item.id] === 'pass' || days < 0 || days > 21 || age < 0 || age > 7) return [];
    if (item.mode === 'live' && (!item.sourceUrl?.startsWith('https://') || verificationAge < 0 || verificationAge > 2)) return [];
    const isFree = preferences.freeAlerts && item.totalCost === 0;
    const reason = watched ? 'A saved interest has a new date' : isFree ? 'A free opportunity in your interests' : 'New and starting soon';
    return [{ item, reason, priority: (watched ? 30 : 0) + (isFree ? 20 : 0) + (21 - days) }];
  }).sort((a, b) => b.priority - a.priority);
}

export function money(amount: number, currency = 'CAD'): string { return amount === 0 ? 'Free' : `${amount} ${currency}`; }
