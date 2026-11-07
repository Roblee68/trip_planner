import { daysUntil, type Experience, type Feedback, type Preferences, type TravelMode } from './logic.ts';

const TWO_DAYS = 48 * 60 * 60 * 1000;
const matchingPlace = (left: string, right: string) => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();

export function serendipityCandidates(items: Experience[], preferences: Preferences, feedback: Feedback, mode: TravelMode, now = new Date()): Experience[] {
  return items.filter(item => {
    if (feedback[item.id] === 'pass' || daysUntil(item.startsAt, now) < 0) return false;
    if ((item.currency ?? 'CAD') !== preferences.currency || item.totalCost > preferences.maxBudget) return false;
    if (mode === 'plane') {
      const route = item.travel;
      const checkedAt = route?.routeCheckedAt ? Date.parse(route.routeCheckedAt) : NaN;
      return item.mode === 'live' && !!item.sourceUrl?.startsWith('https://') &&
        !!route?.modes.includes('plane') && !!route.originPlace && matchingPlace(route.originPlace, preferences.place) &&
        !!route.flightMinutes && route.flightMinutes > 0 && route.flightMinutes < 120 &&
        !!route.routeSourceUrl?.startsWith('https://') && Number.isFinite(checkedAt) &&
        checkedAt <= now.getTime() && now.getTime() - checkedAt <= TWO_DAYS;
    }
    if (item.distanceKm < 0 || item.distanceKm > (mode === 'walk' ? 5 : 100)) return false;
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
