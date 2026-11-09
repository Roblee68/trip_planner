import type { WeeklyLocalEvent } from './remoteScout';

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDaysToDateKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

export function visibleWeeklyLocalEvents(events: WeeklyLocalEvent[], today = localDateKey()): WeeklyLocalEvent[] {
  const last = addDaysToDateKey(today, 6);
  const seen = new Set<string>();
  return events.filter(event => {
    if (!event || event.eventDate < today || event.eventDate > last || !/^https:\/\/[^\s]+$/i.test(event.sourceUrl) || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  }).sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.eventTime || '99:99').localeCompare(b.eventTime || '99:99') || a.title.localeCompare(b.title));
}
