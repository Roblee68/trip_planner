import { daysUntil, type Experience, type Feedback, type Preferences, type TravelMode } from './logic.ts';

export function surpriseSearchPreferences(preferences: Preferences, mode: TravelMode): Preferences {
  return { ...preferences, interests: [], topics: [], travelModes: [mode], maxDistanceKm: mode === 'walk' ? 5 : 30 };
}

export function serendipityCandidates(items: Experience[], preferences: Preferences, feedback: Feedback, mode: TravelMode, now = new Date()): Experience[] {
  return items.filter(item => {
    if (feedback[item.id] === 'pass' || daysUntil(item.startsAt, now) < 0) return false;
    if ((item.currency ?? 'CAD') !== preferences.currency || item.totalCost > preferences.maxBudget) return false;
    if (mode === 'plane' || item.distanceKm < 0 || item.distanceKm > (mode === 'walk' ? 5 : 30)) return false;
    if (item.mode === 'live' && !item.sourceUrl?.startsWith('https://')) return false;
    return !!item.travel?.modes.includes(mode);
  });
}

export function chooseSerendipity(items: Experience[], preferences: Preferences, feedback: Feedback, mode: TravelMode, previousId?: string, random = Math.random): Experience | null {
  if (!(preferences.travelModes ?? []).includes(mode)) return null;
  const candidates = serendipityCandidates(items, preferences, feedback, mode);
  const fresh = candidates.length > 1 ? candidates.filter(item => item.id !== previousId) : candidates;
  if (!fresh.length) return null;
  const draw = Math.max(0, Math.min(0.999999, random()));
  return fresh[Math.floor(draw * fresh.length)];
}
