import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleFeaturedAdventures } from '../lib/featuredAdventures.js';

test('weekly adventures require a searched HTTPS source and exclude last week’s picks', () => {
  const base = { title: 'Northern Lights Lodge', summary: 'A guided multi-day aurora trip.', place: 'Yukon, Canada',
    timing: 'February 2027', lastDate: '2027-02-28', price: 'From CAD $2,000', sourceUrl: 'https://organizer.example/trips/aurora/' };
  const output = eligibleFeaturedAdventures({ adventures: [
    { ...base, sourceUrl: 'https://old.example/trip' },
    { ...base, sourceUrl: 'https://invented.example/trip' },
    { ...base, price: 'Free', sourceUrl: 'https://free.example/trip' },
    base,
    base,
  ] }, new Set([base.sourceUrl, 'https://free.example/trip', 'https://old.example/trip']), ['https://old.example/trip'], new Date('2026-11-08T12:00:00Z'));
  assert.equal(output.length, 1);
  assert.equal(output[0].sourceUrl, base.sourceUrl);
  assert.match(output[0].id, /^featured-/);
});

test('past years cannot be presented as new adventures', () => {
  const sourceUrl = 'https://organizer.example/tour';
  const output = eligibleFeaturedAdventures({ adventures: [{ title: 'Old tour', summary: 'A guided tour.', place: 'Ontario', timing: 'Summer 2025', lastDate: '2025-08-30', price: '$100', sourceUrl }] }, new Set([sourceUrl]), [], new Date('2026-11-08T12:00:00Z'));
  assert.deepEqual(output, []);
});

test('a one-day event cannot fill a seven-day card', () => {
  const sourceUrl = 'https://organizer.example/one-day-event';
  const output = eligibleFeaturedAdventures({ adventures: [{ title: 'One day event', summary: 'A ticketed event.', place: 'Toronto', timing: 'November 10, 2026', lastDate: '2026-11-10', price: '$100', sourceUrl }] }, new Set([sourceUrl]), [], new Date('2026-11-08T12:00:00Z'));
  assert.deepEqual(output, []);
});

test('long timing and price phrases end cleanly in weekly cards', () => {
  const sourceUrl = 'https://organizer.example/winter-tour';
  const output = eligibleFeaturedAdventures({ adventures: [{ title: 'Winter tour', summary: 'A guided trip.', place: 'Alberta',
    timing: 'Winter departures from December 11, 2026 through January 2027 with morning and afternoon sessions',
    lastDate: '2027-02-28', price: 'Adults from CA$104; children from CA$65; includes transfers and all equipment for the full tour', sourceUrl }] },
  new Set([sourceUrl]), [], new Date('2026-11-08T12:00:00Z'));
  assert.equal(output.length, 1);
  assert.match(output[0].timing, /…$/);
  assert.match(output[0].price, /…$/);
  assert.doesNotMatch(output[0].timing, /[,;:]…$/);
  assert.doesNotMatch(output[0].price, /[,;:]…$/);
});
