import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleExtractedFinds, mergeWebDetails, parseImportScanInput } from '../lib/importScan.js';

test('screenshots are bounded and require a supported image type', () => {
  assert.throws(() => parseImportScanInput({ imageBase64: 'abc', imageMime: 'image/jpeg' }));
  assert.throws(() => parseImportScanInput({ sourceUrl: 'http://instagram.com/p/abc' }));
  assert.throws(() => parseImportScanInput({ imageBase64: 'a'.repeat(101), imageMime: 'image/svg+xml' }));
});

test('extracted leads keep ambiguous dates as text and deduplicate rows', () => {
  const rows = eligibleExtractedFinds({ finds: [
    { title: 'Holiday Market', dateText: 'Nov 14', eventDate: '', eventTime: '', venue: 'Town Hall', place: 'Hamilton' },
    { title: 'Holiday Market', dateText: 'Nov 14', eventDate: '', eventTime: '', venue: 'Town Hall', place: 'Hamilton' },
  ] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].eventDate, '');
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
