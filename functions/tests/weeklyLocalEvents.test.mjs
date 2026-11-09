import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleWeeklyLocalEvents, parseWeeklyLocalPlace, weeklyLocalKey } from '../lib/weeklyLocalEvents.js';

test('the same city and country share a weekly cache key', () => {
  assert.equal(weeklyLocalKey('Hamilton, Canada'), weeklyLocalKey(' HAMILTON ,  CANADA '));
  assert.notEqual(weeklyLocalKey('Hamilton, Canada'), weeklyLocalKey('Hamilton, Bermuda'));
  assert.throws(() => parseWeeklyLocalPlace('Hamilton'));
});

test('weekly list keeps only dated local events with observed HTTPS sources', () => {
  const now = new Date('2026-11-08T18:00:00Z');
  const valid = { title: 'Winter makers market', eventDate: '2026-11-14', eventTime: '10:00', category: 'markets', place: 'Hamilton, Canada', sourceUrl: 'https://organizer.example/events/winter-market' };
  const events = eligibleWeeklyLocalEvents({ events: [
    valid,
    valid,
    { ...valid, title: 'Invented listing', sourceUrl: 'https://invented.example/event' },
    { ...valid, title: 'Old event', eventDate: '2026-11-06' },
    { ...valid, title: 'Wrong city', place: 'Toronto, Canada' },
    { ...valid, title: 'Wrong country', place: 'Hamilton, Bermuda' },
    { ...valid, title: 'Bad time', eventTime: '28:30' },
    { ...valid, title: 'Different event query', sourceUrl: `${valid.sourceUrl}?event=other` },
    { ...valid, title: 'Next session', eventDate: '2026-11-15', eventTime: '' },
  ] }, new Set([valid.sourceUrl]), 'Hamilton, Canada', now);
  assert.deepEqual(events.map(event => event.title), ['Winter makers market', 'Next session']);
  assert.match(events[0].id, /^week-/);
});
