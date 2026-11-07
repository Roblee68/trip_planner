import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyMatches, localClock } from '../lib/dailyAlerts.js';
import { parseSubscription } from '../lib/dailyService.js';

const now = new Date('2026-11-05T13:00:00.000Z');
const profile = { place: 'Toronto, Canada', currency: 'CAD', maxBudget: 100, maxDistanceKm: 30, interests: ['Dance'], topics: ['Forests'], travelModes: ['walk', 'transit'], timeZone: 'America/Toronto' };
const event = (id, overrides = {}) => ({ id, title: id, category: 'Dance', summary: 'Class', listedAt: '2026-11-04T00:00:00.000Z', startsAt: '2026-11-07T18:00:00.000Z', signupBy: '2026-11-06T18:00:00.000Z', durationHours: 1, totalCost: 20, distanceKm: 8, currency: 'CAD', location: 'Toronto', place: 'Toronto, Canada', sourceUrl: 'https://organizer.example/event', verifiedAt: '2026-11-05T12:00:00.000Z', status: 'active', mode: 'live', topics: [], travelModes: ['transit'], ...overrides });

test('local scan hour follows each subscriber timezone', () => {
  assert.deepEqual(localClock(now, 'America/Toronto'), { day: '2026-11-05', hour: 8 });
  assert.equal(localClock(now, 'Asia/Tokyo').hour, 22);
});

test('chooses fresh sourced matches for a weekend or approaching sign-up', () => {
  assert.deepEqual(dailyMatches([event('dance')], profile, now).map(match => match.kind), ['signup']);
  assert.deepEqual(dailyMatches([event('forest', { category: 'Outdoors', topics: ['Forests'], signupBy: null })], profile, now).map(match => match.kind), ['weekend']);
});

test('keeps further matches available when top ideas were already sent', () => {
  const matches = dailyMatches([event('first'), event('second'), event('third')], profile, now);
  assert.equal(matches.length, 3);
});

test('excludes stale, full, irrelevant, over-budget, and incompatible travel listings', () => {
  const items = [event('stale', { verifiedAt: '2026-11-03T00:00:00.000Z' }), event('full', { status: 'full' }), event('irrelevant', { category: 'Food' }), event('expensive', { totalCost: 200 }), event('plane', { travelModes: ['plane'] })];
  assert.deepEqual(dailyMatches(items, profile, now), []);
});

test('daily subscription requires a token, bounded preferences, and a real timezone', () => {
  const valid = { ...profile, enabled: true, pushToken: 'ExponentPushToken[abcdefghijklmnop1234]' };
  assert.equal(parseSubscription(valid).timeZone, 'America/Toronto');
  assert.throws(() => parseSubscription({ ...valid, timeZone: 'Not/AZone' }));
  assert.throws(() => parseSubscription({ ...valid, pushToken: 'not-a-token' }));
  assert.throws(() => parseSubscription({ ...valid, enabled: false }));
});
