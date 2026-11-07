import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretIntent, recommendForIntent } from '../src/agent.ts';
import { daysFromNow, defaultPreferences } from '../src/logic.ts';

const item = (id, category, cost, km, hours, days) => ({
  id, title: id, category, format: 'Class', summary: '', location: 'Toronto', distanceKm: km,
  totalCost: cost, durationHours: hours, startsAt: daysFromNow(days), listedAt: daysFromNow(-1), tags: [], alongWay: false, accent: '#000',
});

test('reads practical limits and an interest from a plain-language request', () => {
  const intent = interpretIntent('Find a dance class under $40 within 15 km for 2 hours');
  assert.equal(intent.category, 'Dance');
  assert.equal(intent.budget, 40);
  assert.equal(intent.distanceKm, 15);
  assert.equal(intent.durationHours, 2);
});

test('reads miles in a plain-language request', () => {
  const intent = interpretIntent('Find a forest walk within 10 miles');
  assert.ok(Math.abs(intent.distanceKm - 16.09344) < 1e-8);
});

test('does not suggest an over-budget, distant, long, or passed item', () => {
  const items = [item('fit', 'Dance', 20, 5, 1, 2), item('price', 'Dance', 80, 5, 1, 2), item('far', 'Dance', 20, 30, 1, 2), item('long', 'Dance', 20, 5, 3, 2)];
  const intent = interpretIntent('dance under $40 within 15 km for 2 hours');
  assert.deepEqual(recommendForIntent(items, defaultPreferences, {}, [], intent).map(x => x.item.id), ['fit']);
  assert.deepEqual(recommendForIntent(items, defaultPreferences, { fit: 'pass' }, [], intent), []);
});

test('free and soon are treated as hard constraints', () => {
  const items = [item('free soon', 'Arts', 0, 5, 1, 2), item('paid soon', 'Arts', 20, 5, 1, 2), item('free later', 'Arts', 0, 5, 1, 15)];
  assert.deepEqual(recommendForIntent(items, defaultPreferences, {}, [], interpretIntent('free art this weekend')).map(x => x.item.id), ['free soon']);
});

test('different refinement explores outside the requested category', () => {
  const items = [item('dance', 'Dance', 20, 5, 1, 2), item('pottery', 'Arts', 20, 5, 1, 2), item('food', 'Food', 20, 5, 1, 2)];
  const ranked = recommendForIntent(items, defaultPreferences, {}, [], interpretIntent('dance'), 'different');
  assert.equal(ranked[0].item.id, 'food');
});
