import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleExtractedFinds, mergeWebDetails, observedWebUrls, parseImportScanInput, photoLookupClues } from '../lib/importScan.js';

test('screenshots are bounded and require a supported image type', () => {
  assert.throws(() => parseImportScanInput({ imageBase64: 'abc', imageMime: 'image/jpeg' }));
  assert.throws(() => parseImportScanInput({ sourceUrl: 'http://instagram.com/p/abc' }));
  assert.throws(() => parseImportScanInput({ imageBase64: 'a'.repeat(101), imageMime: 'image/svg+xml' }));
  assert.equal(parseImportScanInput({ imageBase64: 'a'.repeat(101), imageMime: 'image/jpeg', sourceUrl: 'https://organizer.example/post' }).sourceUrl, 'https://organizer.example/post');
});

test('extracted leads keep ambiguous dates as text and deduplicate rows', () => {
  const rows = eligibleExtractedFinds({ finds: [
    { title: 'Holiday Market', dateText: 'Nov 14', eventDate: '', eventTime: '', venue: 'Town Hall', place: 'Hamilton' },
    { title: 'Holiday Market', dateText: 'Nov 14', eventDate: '', eventTime: '', venue: 'Town Hall', place: 'Hamilton' },
  ] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].eventDate, '');
});

test('photo leads search for a website even when all visible fields are complete', () => {
  const photo = [{ title: 'Holiday Market at City Hall', dateText: 'Nov 14, 2026', eventDate: '2026-11-14', eventTime: '18:00', venue: 'City Hall', place: 'Hamilton' }];
  assert.deepEqual(photoLookupClues(photo), [{ ...photo[0], index: 0 }]);
});

test('a page opened by web search counts as an observed source', () => {
  const url = 'https://organizer.example/holiday-market';
  assert.deepEqual(observedWebUrls({ output: [{ type: 'web_search_call', action: { type: 'open_page', url } }] }), new Set([url]));
});

test('a matching public source fills only missing photo details', () => {
  const photo = [{ title: 'Holiday Market at City Hall', dateText: 'Nov 14', eventDate: '', eventTime: '', venue: 'City Hall', place: 'Hamilton' }];
  const sourceUrl = 'https://organizer.example/holiday-market';
  const result = mergeWebDetails(photo, { matches: [{ index: 0, matchedTitle: 'Holiday Market at City Hall', eventDate: '2026-11-14', eventTime: '18:00', venue: 'City Hall', place: 'Hamilton, Ontario', sourceUrl }] }, new Set([sourceUrl]), '2026-11-08');
  assert.equal(result[0].eventDate, '2026-11-14');
  assert.equal(result[0].eventTime, '18:00');
  assert.equal(result[0].dateText, 'Nov 14');
  assert.equal(result[0].sourceUrl, sourceUrl);
});

test('photo details stay unchanged for an unsourced or conflicting web result', () => {
  const photo = [{ title: 'Holiday Market at City Hall', dateText: 'Nov 14', eventDate: '', eventTime: '', venue: 'City Hall', place: 'Hamilton' }];
  const sourceUrl = 'https://organizer.example/holiday-market';
  const base = { index: 0, matchedTitle: 'Holiday Market at City Hall', eventDate: '2026-11-14', eventTime: '18:00', venue: 'City Hall', place: 'Hamilton', sourceUrl };
  assert.deepEqual(mergeWebDetails(photo, { matches: [base] }, new Set(), '2026-11-08'), photo);
  assert.deepEqual(mergeWebDetails(photo, { matches: [{ ...base, place: 'Chicago' }] }, new Set([sourceUrl]), '2026-11-08'), photo);
  assert.deepEqual(mergeWebDetails(photo, { matches: [{ ...base, matchedTitle: 'Winter Food Festival' }] }, new Set([sourceUrl]), '2026-11-08'), photo);
  assert.deepEqual(mergeWebDetails(photo, { matches: [{ ...base, eventDate: '2026-12-14' }] }, new Set([sourceUrl]), '2026-11-08'), photo);
  assert.deepEqual(mergeWebDetails(photo, { matches: [{ ...base, eventDate: '2025-11-14' }] }, new Set([sourceUrl]), '2026-11-08'), photo);
});
