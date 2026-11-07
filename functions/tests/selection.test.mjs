import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceKm, eligibleCandidates, finalizeResponse, parseScoutRequest } from '../lib/selection.js';

const request = parseScoutRequest({ prompt: 'Something free within 20 km for 2 hours', place: 'Paris, France', currency: 'EUR', maxBudget: 50, maxDistanceKm: 30, interests: ['Arts'], refinement: 'balanced' });
const event = (id, overrides = {}) => ({ id, title: id, category: 'Arts', summary: '', listedAt: new Date(Date.now() - 86_400_000).toISOString(), startsAt: new Date(Date.now() + 86_400_000).toISOString(), durationHours: 1, totalCost: 0, currency: 'EUR', distanceKm: 8, location: 'Paris', place: 'Paris, France', sourceUrl: 'https://example.org/event', verifiedAt: new Date().toISOString(), status: 'active', mode: 'live', ...overrides });

test('accepts a location and currency without assuming Toronto or CAD', () => {
  assert.equal(request.place, 'Paris, France');
  assert.equal(request.currency, 'EUR');
  assert.ok(distanceKm(48.8566, 2.3522, 51.5074, -0.1278) > 300);
});

test('accepts selected specific interests and travel modes', () => {
  const selected = parseScoutRequest({ prompt: 'Find a pottery class', place: 'Paris, France', currency: 'EUR', maxBudget: 50, maxDistanceKm: 30, interests: ['Arts'], topics: ['Pottery', 'Classes'], travelModes: ['train', 'ferry', 'unknown'] });
  assert.deepEqual(selected.topics, ['Pottery', 'Classes']);
  assert.deepEqual(selected.travelModes, ['train', 'ferry']);
});

test('today search requires a valid local date and limited available time', () => {
  const base = { prompt: 'Today', place: 'Paris, France', currency: 'EUR', maxBudget: 50, maxDistanceKm: 30, occasion: 'today' };
  assert.throws(() => parseScoutRequest({ ...base, localDate: '2026-11-07', timeAvailableHours: 0 }));
  assert.throws(() => parseScoutRequest({ ...base, localDate: '07/11/2026', timeAvailableHours: 2 }));
  const selected = parseScoutRequest({ ...base, localDate: '2026-11-07', timeAvailableHours: 2 });
  assert.equal(selected.occasion, 'today');
  assert.equal(selected.timeAvailableHours, 2);
});

test('route search keeps the journey and detour bounded', () => {
  const base = { prompt: 'Find a stop', place: 'Hamilton, Canada', currency: 'CAD', maxBudget: 75, maxDistanceKm: 80, occasion: 'route', routeDestination: 'Niagara Falls, Canada', routeStyle: 'highway', routeVia: 'QEW', detourMinutes: 30, routeTiming: 'weekend' };
  const selected = parseScoutRequest(base);
  assert.equal(selected.routeDestination, 'Niagara Falls, Canada');
  assert.equal(selected.routeVia, 'QEW');
  assert.equal(selected.detourMinutes, 30);
  assert.throws(() => parseScoutRequest({ ...base, detourMinutes: 180 }));
  assert.throws(() => parseScoutRequest({ ...base, routeDestination: 'Hamilton, Canada' }));
});

test('serendipity discards loved examples sent by a client', () => {
  const selected = parseScoutRequest({ prompt: 'Surprise me', place: 'Hamilton, Canada', currency: 'CAD', maxBudget: 100, maxDistanceKm: 30, interests: [], topics: [], travelModes: ['car'], occasion: 'surprise', likedExamples: ['Ballroom class'] });
  assert.deepEqual(selected.likedExamples, []);
});

test('ordinary searches accept a bounded list of explicitly loved ideas', () => {
  const selected = parseScoutRequest({ prompt: 'Find ideas', place: 'Hamilton, Canada', currency: 'CAD', maxBudget: 100, maxDistanceKm: 30, likedExamples: ['Pottery class', 'Guided food tour'] });
  assert.deepEqual(selected.likedExamples, ['Pottery class', 'Guided food tour']);
});

test('treats mile limits in a scout prompt as kilometres internally', () => {
  const miles = parseScoutRequest({ prompt: 'Within 10 miles', place: 'Paris, France', currency: 'EUR', maxBudget: 50, maxDistanceKm: 30 });
  assert.deepEqual(eligibleCandidates([event('near', { distanceKm: 15 }), event('far', { distanceKm: 18 })], miles).map(item => item.id), ['near']);
});

test('keeps only local, within-budget, open, source-linked events', () => {
  const items = [event('fit'), event('paid', { totalCost: 25 }), event('other city', { place: 'London, UK' }), event('wrong currency', { currency: 'GBP' }), event('sold out', { status: 'full' }), event('no link', { sourceUrl: null }), event('stale', { verifiedAt: new Date(Date.now() - 72 * 3_600_000).toISOString() })];
  assert.deepEqual(eligibleCandidates(items, request).map(item => item.id), ['fit']);
});

test('uses coordinates when an experience is near a different named place', () => {
  const located = { ...request, prompt: 'Something under 50 EUR', latitude: 48.8566, longitude: 2.3522 };
  const nearby = event('nearby', { place: 'Saint-Denis, France', latitude: 48.9356, longitude: 2.3539, distanceKm: 999 });
  const result = eligibleCandidates([nearby], located);
  assert.equal(result.length, 1);
  assert.ok(result[0].distanceKm < 20);
});

test('discards invented or duplicate AI picks and copies facts from the catalog', () => {
  const allowed = [event('real')];
  const response = finalizeResponse({ message: 'Try this.', picks: [{ id: 'invented', reason: 'Amazing' }, { id: 'real', reason: 'Matches your interests' }, { id: 'real', reason: 'Again' }], followUp: null }, allowed);
  assert.deepEqual(response.picks.map(pick => pick.id), ['real']);
  assert.equal(response.picks[0].sourceUrl, 'https://example.org/event');
  assert.equal(response.picks[0].currency, 'EUR');
  assert.equal(response.picks[0].place, 'Paris, France');
  assert.equal(response.picks[0].listedAt, allowed[0].listedAt);
});
