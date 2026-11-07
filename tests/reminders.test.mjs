import test from 'node:test';
import assert from 'node:assert/strict';
import { planReminders } from '../src/reminders.ts';
import { defaultPreferences } from '../src/logic.ts';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-11-07T15:00:00.000Z');
const preferences = { ...defaultPreferences, phoneAlertsEnabled: true, place: 'Toronto, Canada' };
const live = (overrides = {}) => ({
  id: 'ballroom', title: 'Beginner ballroom', category: 'Dance', format: 'Class', summary: '',
  location: 'Toronto', place: 'Toronto, Canada', distanceKm: 8, totalCost: 95, currency: 'CAD', durationHours: 1,
  startsAt: new Date(now.getTime() + 36 * HOUR).toISOString(), signupBy: new Date(now.getTime() + 18 * HOUR).toISOString(),
  listedAt: now.toISOString(), verifiedAt: now.toISOString(), status: 'active', sourceUrl: 'https://example.org/ballroom',
  mode: 'live', tags: [], alongWay: false, accent: '#103D46', ...overrides,
});

test('plans sign-up and upcoming reminders only for an interested, sourced live event', () => {
  const plans = planReminders([live()], preferences, {}, [], now);
  assert.deepEqual(plans.map(plan => plan.key.split(':')[1]), ['signup', 'starts']);
  assert.ok(plans.every(plan => plan.sourceUrl === 'https://example.org/ballroom'));
  assert.deepEqual(planReminders([live()], { ...preferences, phoneAlertsEnabled: false }, {}, [], now), []);
});

test('rejects stale, full, distant, passed, and sample activities', () => {
  const items = [
    live({ id: 'stale', verifiedAt: new Date(now.getTime() - 25 * HOUR).toISOString() }),
    live({ id: 'full', status: 'full' }),
    live({ id: 'far', distanceKm: 90 }),
    live({ id: 'passed' }),
    live({ id: 'sample', mode: 'sample', sourceUrl: undefined }),
  ];
  assert.deepEqual(planReminders(items, preferences, { passed: 'pass' }, [], now), []);
});
