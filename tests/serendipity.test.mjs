import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSerendipity, serendipityCandidates } from '../src/serendipity.ts';
import { defaultPreferences, daysFromNow } from '../src/logic.ts';

const preferences = { ...defaultPreferences, place: 'Toronto, Canada', maxBudget: 200 };
const item = (id, distanceKm, travel = { modes: ['car', 'train'] }, overrides = {}) => ({
  id, title: id, category: 'Outdoors', format: 'Outing', summary: '', location: 'Toronto', distanceKm,
  totalCost: 20, durationHours: 2, startsAt: daysFromNow(7), listedAt: daysFromNow(-1),
  tags: [], alongWay: false, accent: '#103D46', travel, mode: 'sample', ...overrides,
});

test('walk stays nearby and car and train stay within 100 km', () => {
  const items = [item('near', 5, { modes: ['walk', 'car', 'train'] }), item('mid', 80), item('far', 101), item('no-train', 30, { modes: ['car'] })];
  assert.deepEqual(serendipityCandidates(items, preferences, {}, 'walk').map(value => value.id), ['near']);
  assert.deepEqual(serendipityCandidates(items, preferences, {}, 'car').map(value => value.id), ['near', 'mid', 'no-train']);
  assert.deepEqual(serendipityCandidates(items, preferences, {}, 'train').map(value => value.id), ['near', 'mid']);
});

test('plane requires a live sourced activity and a recent verified flight under two hours', () => {
  const now = new Date();
  const route = { modes: ['plane'], originPlace: 'Toronto, Canada', flightMinutes: 119, routeSourceUrl: 'https://example.org/flight', routeCheckedAt: now.toISOString() };
  const live = (id, changes = {}) => item(id, 800, { ...route, ...changes }, { mode: 'live', sourceUrl: 'https://example.org/activity' });
  const items = [live('fit'), live('two-hours', { flightMinutes: 120 }), live('stale', { routeCheckedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString() }), live('wrong-origin', { originPlace: 'Winnipeg, Canada' }), item('sample-flight', 800, route)];
  assert.deepEqual(serendipityCandidates(items, preferences, {}, 'plane', now).map(value => value.id), ['fit']);
});

test('repeat surprise draws another eligible idea when possible', () => {
  const items = [item('first', 15), item('second', 20)];
  assert.equal(chooseSerendipity(items, preferences, {}, 'car', 'first', () => 0)?.id, 'second');
});
