import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceKm, eligibleCandidates, finalizeResponse, parseScoutRequest } from '../lib/selection.js';

const request = parseScoutRequest({ prompt: 'Something free within 20 km for 2 hours', place: 'Paris, France', currency: 'EUR', maxBudget: 50, maxDistanceKm: 30, interests: ['Arts'], refinement: 'balanced' });
const event = (id, overrides = {}) => ({ id, title: id, category: 'Arts', summary: '', startsAt: new Date(Date.now() + 86_400_000).toISOString(), durationHours: 1, totalCost: 0, currency: 'EUR', distanceKm: 8, location: 'Paris', place: 'Paris, France', sourceUrl: 'https://example.org/event', verifiedAt: new Date().toISOString(), status: 'active', mode: 'live', ...overrides });

test('accepts a location and currency without assuming Toronto or CAD', () => {
  assert.equal(request.place, 'Paris, France');
  assert.equal(request.currency, 'EUR');
  assert.ok(distanceKm(48.8566, 2.3522, 51.5074, -0.1278) > 300);
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
});
