import { normalizeEvent, type StoredEvent } from './eventRecords.js';

export const TORONTO_FEED = 'https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/9201059e-43ed-4369-885e-0b867652feac/resource/8900fdb2-7f6c-4f50-8581-b463311ff05d/download/file.json';

/** The official feed is over 200 MB. Parse one array row at a time, not the entire export. */
export async function* jsonArrayRows(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const decoder = new TextDecoder();
  let array = false, depth = 0, quoted = false, escaped = false, row = '', bytes = 0, closed = false;
  for await (const chunk of chunks) {
    bytes += chunk.byteLength;
    if (bytes > 400_000_000) throw new Error('Event feed exceeds import limit');
    const text = decoder.decode(chunk, { stream: true });
    for (const char of text) {
      if (!array) { if (char === '[') array = true; continue; }
      if (!depth) {
        if (char === ']') { closed = true; break; }
        if (char === '{') { depth = 1; row = '{'; }
        continue;
      }
      row += char;
      if (row.length > 2_000_000) throw new Error('Event row exceeds import limit');
      if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
      else if (char === '"') quoted = true;
      else if (char === '{' || char === '[') depth++;
      else if (char === '}' || char === ']') {
        depth--;
        if (!depth) { yield JSON.parse(row) as Record<string, unknown>; row = ''; }
      }
    }
    if (closed) break;
  }
  if (!array || !closed || depth) throw new Error('Incomplete event feed; retaining the previous collection');
}

export function torontoEvent(row: Record<string, unknown>, now = new Date()): StoredEvent | null {
  const startsAt = String(row.calendar_date ?? '');
  const stamp = new Date(startsAt);
  if (!Number.isFinite(stamp.getTime()) || !/([+-]\d{2}:\d{2}|Z)$/.test(startsAt)) return null;
  const date = startsAt.slice(0, 10), time = startsAt.slice(11, 16);
  const locations = Array.isArray(row.event_locations) ? row.event_locations as Record<string, unknown>[] : [];
  const location = locations[0] ?? {};
  const numeric = (value: unknown) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  // A range's minimum is not a guaranteed admission price. Use the stated adult/general amount only.
  const price = row.free_event === 'Yes' ? 0 : numeric(row.event_price_adult) ?? numeric(row.event_price);
  let endsAt: string | null = null;
  try {
    const ranges = JSON.parse(String(location.location_dates ?? '[]')) as Record<string, unknown>[];
    for (const range of ranges) {
      const multiple = Array.isArray(range.multiple_dates) ? range.multiple_dates as Record<string, unknown>[] : [];
      const dated = multiple.find(value => value.sdate === date) ?? (range.startdate === date ? range : undefined);
      if (!dated) continue;
      const clock = String(dated.etime ?? dated.endtime ?? '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (clock) {
        const hour = Number(clock[1]) % 12 + (clock[3].toUpperCase() === 'PM' ? 12 : 0);
        const endDate = String(dated.edate || dated.enddate || date);
        endsAt = `${endDate}T${String(hour).padStart(2,'0')}:${clock[2]}:00${startsAt.slice(-6)}`;
      }
    }
  } catch { /* Missing/ambiguous duration remains unknown. */ }
  const organizer = typeof row.event_website === 'string' && row.event_website.startsWith('https://') ? row.event_website :
    'https://open.toronto.ca/dataset/festivals-events/';
  const categoryText = Array.isArray(row.event_category) ? row.event_category.join(' ') : '';
  const category = /dance|class|workshop/i.test(categoryText) ? 'classes' : /music/i.test(categoryText) ? 'music' : /theatre/i.test(categoryText) ? 'theatre' : /art|exhibit/i.test(categoryText) ? 'arts' : /food/i.test(categoryText) ? 'food' : /sport/i.test(categoryText) ? 'sports' : /outdoor|nature/i.test(categoryText) ? 'outdoors' : 'community';
  return normalizeEvent({ title: row.event_name, summary: row.event_description || row.short_description, category,
    topics: row.event_category, eventDate: date, eventTime: time, startsAt, endsAt,
    priceAmount: price, currency: 'CAD', venue: location.location_name || location.location_address,
    address: location.location_address, latitude: numeric(location.geo_lat), longitude: numeric(location.geo_long),
    sourceUrl: organizer, sourceEventId: row.id || row.calendar_id,
    status: /cancel/i.test(String(row.event_status)) ? 'cancelled' : 'active',
    attribution: 'Contains information licensed under the Open Government Licence – Toronto.' }, 'Toronto, Canada', 'America/Toronto', now, 'toronto-open-data');
}

export async function collectTorontoEvents(now = new Date()): Promise<StoredEvent[]> {
  const response = await fetch(TORONTO_FEED, { signal: AbortSignal.timeout(180_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`Toronto feed returned ${response.status}`);
  const events = new Map<string, StoredEvent>();
  for await (const row of jsonArrayRows(response.body)) {
    const event = torontoEvent(row, now);
    if (event) events.set(event.id, event);
  }
  return [...events.values()];
}
