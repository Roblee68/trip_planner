import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSerendipity, serendipityCandidates, surpriseSearchPreferences } from '../src/serendipity.ts';
import { defaultPreferences, daysFromNow } from '../src/logic.ts';

const preferences = { ...defaultPreferences, place: 'Toronto, Canada', maxBudget: 200 };
const item = (id, distanceKm, travel = { modes: ['car', 'train'] }, overrides = {}) => ({
  id, title: id, category: 'Outdoors', format: 'Outing', summary: '', location: 'Toronto', distanceKm,
  totalCost: 20, durationHours: 2, startsAt: daysFromNow(7), listedAt: daysFromNow(-1),
  tags: [], alongWay: false, accent: '#103D46', travel, mode: 'sample', ...overrides,
});

test('walk stays nearby and other local modes stay within 30 km', () => {
  const items = [item('near', 5, { modes: ['walk', 'car', 'train'] }), item('mid', 29), item('far', 31), item('no-train', 30, { modes: ['car'] })];
  assert.deepEqual(serendipityCandidates(items, preferences, {}, 'walk').map(value => value.id), ['near']);
  assert.deepEqual(serendipityCandidates(items, preferences, {}, 'car').map(value => value.id), ['near', 'mid', 'no-train']);
  assert.deepEqual(serendipityCandidates(items, preferences, {}, 'train').map(value => value.id), ['near', 'mid']);
});

test('the surprise search leaves likes behind and never offers a local flight', () => {
  const selected = surpriseSearchPreferences({ ...preferences, interests: ['Dance'], topics: ['Dancing'], maxDistanceKm: 100 }, 'car');
  assert.deepEqual(selected.interests, []);
  assert.deepEqual(selected.topics, []);
  assert.deepEqual(selected.travelModes, ['car']);
  assert.equal(selected.maxDistanceKm, 30);
  assert.deepEqual(serendipityCandidates([item('flight', 10, { modes: ['plane'] })], { ...preferences, travelModes: ['plane'] }, {}, 'plane'), []);
});

test('repeat surprise draws another eligible idea when possible', () => {
  const items = [item('first', 15), item('second', 20)];
  assert.equal(chooseSerendipity(items, preferences, {}, 'car', 'first', () => 0)?.id, 'second');
});
