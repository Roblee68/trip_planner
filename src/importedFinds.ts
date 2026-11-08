export type ExtractedFind = {
  title: string;
  dateText: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  place: string;
  sourceUrl?: string;
};

export type ImportedFind = Omit<ExtractedFind, 'sourceUrl'> & {
  id: string;
  sourceUrl: string | null;
  imageUri: string | null;
  savedAt: string;
  reminderAt: string | null;
};

export function findMentionsArea(find: ExtractedFind, area: string): boolean {
  const words = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const city = words(area.split(',')[0] ?? '');
  if (city.length < 3) return false;
  const visiblePlace = words(find.place);
  const haystack = visiblePlace || words(`${find.title} ${find.venue}`);
  return ` ${haystack} `.includes(` ${city} `);
}

export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export function parseLocalDateTime(dateText: string, timeText: string): Date | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeText.trim());
  if (!date || !time) return null;
  const [, year, month, day] = date.map(Number);
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  const value = new Date(year, month - 1, day, hour, minute);
  return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day && value.getHours() === hour && value.getMinutes() === minute ? value : null;
}

export function parseLocalDate(dateText: string): Date | null {
  return parseLocalDateTime(dateText, '12:00');
}

export function reminderSuggestion(eventDate: string, eventTime: string, daysBefore: number): Date | null {
  const event = parseLocalDateTime(eventDate, eventTime || '09:00');
  if (!event) return null;
  const reminder = new Date(event);
  reminder.setDate(reminder.getDate() - daysBefore);
  if (!eventTime) reminder.setHours(9, 0, 0, 0);
  return reminder;
}

export function localInputParts(date: Date): { date: string; time: string } {
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}
