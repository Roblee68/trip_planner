import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPreferences, daysFromNow, matchedTopics, opportunityAlerts, rankExperiences } from '../src/logic.ts';

const item = (id, category, cost, km, starts, listed = -1) => ({
  id, title: id, category, format: 'Workshop', summary: '', location: 'Toronto', distanceKm: km,
  totalCost: cost, durationHours: 2, startsAt: daysFromNow(starts), listedAt: daysFromNow(listed), tags: [], alongWay: false, accent: '#000',
});

test('ranking enforces budget, radius, and passes', () => {
  const items = [item('fit', 'Dance', 20, 5, 7), item('price', 'Dance', 200, 5, 7), item('far', 'Dance', 20, 80, 7)];
  assert.deepEqual(rankExperiences(items, defaultPreferences, {}, []).map(x => x.id), ['fit']);
  assert.deepEqual(rankExperiences(items, defaultPreferences, { fit: 'pass' }, []), []);
});

test('feedback changes category ranking', () => {
  const items = [item('arts', 'Arts', 20, 5, 7), item('dance1', 'Dance', 20, 5, 7), item('dance2', 'Dance', 20, 5, 7)];
  const ranked = rankExperiences(items, defaultPreferences, { dance1: 'love' }, []);
  assert.equal(ranked[0].id, 'dance2');
});

test('alerts require recent, relevant, timely listings within practical limits', () => {
  const items = [item('yes', 'Dance', 0, 5, 5), item('old', 'Dance', 0, 5, 5, -12), item('far', 'Dance', 0, 80, 5), item('late', 'Dance', 0, 5, 35), item('unrelated', 'Food', 0, 5, 5)];
  assert.deepEqual(opportunityAlerts(items, defaultPreferences, {}, []).map(x => x.item.id), ['yes']);
  assert.deepEqual(opportunityAlerts(items, { ...defaultPreferences, alertsEnabled: false }, {}, []), []);
});

test('live alerts need a recent source check and a linked source', () => {
  const base = { ...item('live', 'Dance', 10, 5, 3), mode: 'live', currency: 'CAD', sourceUrl: 'https://organizer.example/event', verifiedAt: new Date().toISOString() };
  assert.equal(opportunityAlerts([base], defaultPreferences, {}, []).length, 1);
  assert.equal(opportunityAlerts([{ ...base, sourceUrl: undefined }], defaultPreferences, {}, []).length, 0);
  assert.equal(opportunityAlerts([{ ...base, verifiedAt: daysFromNow(-3) }], defaultPreferences, {}, []).length, 0);
  assert.equal(opportunityAlerts([{ ...base, currency: 'EUR' }], defaultPreferences, {}, []).length, 0);
});

test('specific interests match activities and selected travel modes limit the feed', () => {
  const pottery = { ...item('ceramic mug workshop', 'Arts', 30, 8, 5), summary: 'A hands-on pottery class', travel: { modes: ['transit', 'train'] } };
  assert.deepEqual(matchedTopics(pottery, ['Pottery', 'Classes', 'Hiking']), ['Pottery', 'Classes']);
  const settings = { ...defaultPreferences, interests: [], topics: ['Pottery'], travelModes: ['transit'] };
  assert.deepEqual(rankExperiences([pottery], settings, {}, []).map(value => value.id), [pottery.id]);
  assert.deepEqual(rankExperiences([pottery], { ...settings, travelModes: ['car'] }, {}, []), []);
});
