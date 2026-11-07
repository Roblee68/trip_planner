import { matchedTopics, withinLimits, type Experience, type Feedback, type Preferences } from './logic.ts';

export type ReminderPlan = { key: string; itemId: string; at: string; title: string; body: string; sourceUrl: string };
const HOUR = 60 * 60 * 1000;
const SOURCE_AGE = 24 * HOUR;
const HORIZON = 48 * HOUR;

export function planReminders(items: Experience[], preferences: Preferences, feedback: Feedback, savedIds: string[], now = new Date()): ReminderPlan[] {
  if (!preferences.phoneAlertsEnabled) return [];
  const plans: ReminderPlan[] = [];
  for (const item of items) {
    if (item.mode !== 'live' || item.status === 'cancelled' || item.status === 'full' || feedback[item.id] === 'pass') continue;
    if (!item.sourceUrl?.startsWith('https://') || !withinLimits(item, preferences)) continue;
    if (item.travel && !item.travel.modes.some(mode => (preferences.travelModes ?? []).includes(mode))) continue;
    if (!preferences.interests.includes(item.category) && !matchedTopics(item, preferences.topics ?? []).length && !savedIds.includes(item.id)) continue;
    const checkedAt = item.verifiedAt ? Date.parse(item.verifiedAt) : NaN;
    if (!Number.isFinite(checkedAt) || checkedAt > now.getTime() || now.getTime() - checkedAt > SOURCE_AGE) continue;
    for (const kind of ['signup', 'starts'] as const) {
      const target = Date.parse(kind === 'signup' ? item.signupBy ?? '' : item.startsAt);
      if (!Number.isFinite(target) || target <= now.getTime() + 60_000 || target > now.getTime() + HORIZON) continue;
      const at = Math.max(now.getTime() + 60_000, target - (kind === 'signup' ? 24 : 12) * HOUR);
      if (at >= target) continue;
      plans.push({
        key: `${item.id}:${kind}:${new Date(at).toISOString()}`,
        itemId: item.id,
        at: new Date(at).toISOString(),
        title: kind === 'signup' ? `Sign-up window: ${item.title}` : `Coming up: ${item.title}`,
        body: kind === 'signup' ? 'The listed sign-up deadline is near. Check the organizer source before booking.' : 'This may fit your plans. Confirm time, availability and weather with the organizer.',
        sourceUrl: item.sourceUrl,
      });
    }
  }
  return plans.sort((a, b) => a.at.localeCompare(b.at)).slice(0, 10);
}
