import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleWebLeads, searchedUrls } from '../lib/webDaily.js';

const now = new Date('2026-11-05T13:00:00.000Z');
const profile = { place: 'Hamilton, Canada', currency: 'CAD', maxBudget: 100, maxDistanceKm: 30, interests: ['Arts'], topics: ['Metalwork'], travelModes: ['walk', 'transit'], timeZone: 'America/Toronto' };
const url = 'https://organizer.example/workshop';
const lead = (overrides = {}) => ({ title: 'Blacksmithing workshop', sourceUrl: url, startsAt: '2026-11-07T18:00:00.000Z', signupBy: '2026-11-06T18:00:00.000Z', place: 'Hamilton, Canada', category: 'Arts', topic: 'Metalwork', cost: 45, currency: 'CAD', distanceKm: 10, travelMode: 'transit', ...overrides });

test('accepts only leads linked to a URL returned by web search', () => {
  const urls = searchedUrls({ output: [{ type: 'web_search_call', action: { type: 'search', sources: [{ type: 'url', url }] } }] });
  assert.deepEqual(eligibleWebLeads({ leads: [lead()] }, urls, profile, now).map(item => item.kind), ['signup']);
  assert.deepEqual(eligibleWebLeads({ leads: [lead({ sourceUrl: 'https://invented.example/event' })] }, urls, profile, now), []);
});

test('drops mismatched or unverifiable leads and recognizes a weekend idea', () => {
  const urls = new Set([url]);
  assert.deepEqual(eligibleWebLeads({ leads: [lead({ signupBy: null })] }, urls, profile, now).map(item => item.kind), ['weekend']);
  assert.deepEqual(eligibleWebLeads({ leads: [lead({ cost: 200 }), lead({ place: 'Toronto, Canada' }), lead({ startsAt: 'yesterday' }), lead({ sourceUrl: 'http://organizer.example/workshop' }), lead({ category: 'Food', topic: 'Cooking' }), lead({ travelMode: 'car' }), lead({ travelMode: 'walk' })] }, urls, profile, now), []);
});
