import assert from 'node:assert/strict';
import test from 'node:test';
import { addDaysToDateKey, visibleWeeklyLocalEvents } from '../src/weeklyLocal.ts';

test('the weekly list slides through the next seven calendar days', () => {
  const event = (id, eventDate) => ({ id, title: id, eventDate, eventTime: '', category: 'other', place: 'Hamilton, Canada', sourceUrl: `https://example.org/${id}`, sourceName: 'example.org' });
  const events = visibleWeeklyLocalEvents([
    event('next-week', '2026-11-15'), event('today', '2026-11-08'), event('last-day', '2026-11-14'),
    event('past', '2026-11-07'), event('today', '2026-11-08'), { ...event('unsafe', '2026-11-09'), sourceUrl: 'http://example.org/unsafe' },
  ], '2026-11-08');
  assert.deepEqual(events.map(item => item.id), ['today', 'last-day']);
  assert.equal(addDaysToDateKey('2026-12-29', 6), '2027-01-04');
});
