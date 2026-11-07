import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleWebIdeas, sourceCitations } from '../lib/webScout.js';

test('retains only valid HTTPS citations within the response text', () => {
  const text = 'See this event [1].';
  const links = sourceCitations(text, [
    { type: 'url_citation', start_index: 15, end_index: 18, url: 'https://organizer.example/event', title: 'Organizer' },
    { type: 'url_citation', start_index: 2, end_index: 5, url: 'http://unsafe.example', title: 'Unsafe' },
    { type: 'url_citation', start_index: 100, end_index: 104, url: 'https://other.example', title: 'Out of bounds' },
  ]);
  assert.deepEqual(links, [{ startIndex: 15, endIndex: 18, url: 'https://organizer.example/event', title: 'Organizer' }]);
});

test('builds idea cards only from URLs returned by web search', () => {
  const request = { place: 'Hamilton, Canada' };
  const idea = { title: 'Pottery workshop', summary: 'Try a wheel class.', reason: 'Matches pottery.',
    dateText: 'November 14 ([Organizer](https://organizer.example/workshop))', priceText: '$45 CAD', venue: 'Clay Studio', address: '1 Main Street',
    sourceUrl: 'https://organizer.example/workshop/' };
  const sources = new Set(['https://organizer.example/workshop']);
  const result = eligibleWebIdeas({ ideas: [idea, idea, { ...idea, sourceUrl: 'https://invented.example/workshop' }] }, sources, request, new Date('2026-11-07T20:00:00Z'));
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Pottery workshop');
  assert.equal(result[0].place, 'Hamilton, Canada');
  assert.equal(result[0].sourceUrl, idea.sourceUrl);
  assert.equal(result[0].dateText, 'November 14');
  assert.match(result[0].id, /^web-/);
});
