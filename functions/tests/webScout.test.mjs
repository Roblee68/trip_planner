import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceCitations } from '../lib/webScout.js';

test('retains only valid HTTPS citations within the response text', () => {
  const text = 'See this event [1].';
  const links = sourceCitations(text, [
    { type: 'url_citation', start_index: 15, end_index: 18, url: 'https://organizer.example/event', title: 'Organizer' },
    { type: 'url_citation', start_index: 2, end_index: 5, url: 'http://unsafe.example', title: 'Unsafe' },
    { type: 'url_citation', start_index: 100, end_index: 104, url: 'https://other.example', title: 'Out of bounds' },
  ]);
  assert.deepEqual(links, [{ startIndex: 15, endIndex: 18, url: 'https://organizer.example/event', title: 'Organizer' }]);
});
