import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleExtractedFinds, mergeWebDetails, observedWebUrls, parseImportScanInput, photoLookupClues } from '../lib/importScan.js';

test('screenshots are bounded and require a supported image type', () => {
  assert.throws(() => parseImportScanInput({ imageBase64: 'abc', imageMime: 'image/jpeg' }));
  assert.throws(() => parseImportScanInput({ sourceUrl: 'http://instagram.com/p/abc' }));
  assert.throws(() => parseImportScanInput({ imageBase64: 'a'.repeat(101), imageMime: 'image/svg+xml' }));
  assert.equal(parseImportScanInput({ imageBase64: 'a'.repeat(101), imageMime: 'image/jpeg', sourceUrl: 'https://organizer.example/post' }).sourceUrl, 'https://organizer.example/post');
});

test('selected lookup accepts only a short list of named photo leads', () => {
  const lead = { title: 'Holiday Market', dateText: 'Nov 14', eventDate: '', eventTime: '', venue: 'Town Hall', place: 'Hamilton' };
  assert.equal(parseImportScanInput({ lookupMode: 'extract', imageBase64: 'a'.repeat(101), imageMime: 'image/jpeg' }).lookupMode, 'extract');
  assert.deepEqual(parseImportScanInput({ lookupMode: 'selected', selectedFinds: [lead], place: 'Hamilton, Canada' }).selectedFinds?.[0], lead);
  assert.throws(() => parseImportScanInput({ lookupMode: 'selected', selectedFinds: Array(6).fill(lead) }));
  assert.throws(() => parseImportScanInput({ lookupMode: 'selected', selectedFinds: [{ ...lead, title: '' }] }));
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
  const result = mergeWebDetails(photo, { matches: [{ index: 0, matchedTitle: 'Holiday Market at City Hall', dateText: 'Nov 14, 2026', dateKind: 'single', eventDate: '2026-11-14', eventTime: '18:00', rangeStart: '', rangeEnd: '', venue: 'City Hall', place: 'Hamilton, Ontario', sourceUrl }] }, new Set([sourceUrl]), '2026-11-08');
  assert.equal(result[0].eventDate, '2026-11-14');
  assert.equal(result[0].eventTime, '18:00');
  assert.equal(result[0].dateText, 'Nov 14, 2026');
  assert.equal(result[0].sourceUrl, sourceUrl);
});

test('photo details stay unchanged for an unsourced or conflicting web result', () => {
  const photo = [{ title: 'Holiday Market at City Hall', dateText: 'Nov 14', eventDate: '', eventTime: '', venue: 'City Hall', place: 'Hamilton' }];
  const sourceUrl = 'https://organizer.example/holiday-market';
  const base = { index: 0, matchedTitle: 'Holiday Market at City Hall', dateText: 'Nov 14, 2026', dateKind: 'single', eventDate: '2026-11-14', eventTime: '18:00', rangeStart: '', rangeEnd: '', venue: 'City Hall', place: 'Hamilton', sourceUrl };
  assert.deepEqual(mergeWebDetails(photo, { matches: [base] }, new Set(), '2026-11-08'), photo);
  assert.deepEqual(mergeWebDetails(photo, { matches: [{ ...base, place: 'Chicago' }] }, new Set([sourceUrl]), '2026-11-08'), photo);
  assert.deepEqual(mergeWebDetails(photo, { matches: [{ ...base, matchedTitle: 'Winter Food Festival' }] }, new Set([sourceUrl]), '2026-11-08'), photo);
  assert.deepEqual(mergeWebDetails(photo, { matches: [{ ...base, eventDate: '2026-12-14' }] }, new Set([sourceUrl]), '2026-11-08'), photo);
  assert.deepEqual(mergeWebDetails(photo, { matches: [{ ...base, eventDate: '2025-11-14' }] }, new Set([sourceUrl]), '2026-11-08'), photo);
});

test('Casa Loma social headline links to the organizer event without treating Hogwarts as official', () => {
  const photo = [{ title: "Toronto's Casa Loma is turning into a real-life Hogwarts for Christmas", dateText: '', eventDate: '', eventTime: '', venue: 'Casa Loma', place: 'Toronto' }];
  const sourceUrl = 'https://casaloma.ca/project/christmas-at-the-castle/';
  const match = { index: 0, matchedTitle: 'Christmas at the Castle and Holiday Lights', dateText: 'December 4, 2026–January 2, 2027', dateKind: 'range', eventDate: '', eventTime: '', rangeStart: '2026-12-04', rangeEnd: '2027-01-02', venue: 'Casa Loma', place: 'Toronto', sourceUrl };
  const result = mergeWebDetails(photo, { matches: [match] }, new Set([sourceUrl]), '2026-11-08');
  assert.equal(result[0].title, 'Christmas at the Castle and Holiday Lights');
  assert.equal(result[0].dateText, 'Dec 4, 2026 – Jan 2, 2027');
  assert.equal(result[0].eventDate, '');
  assert.equal(result[0].eventTime, '');
  assert.equal(result[0].sourceUrl, sourceUrl);
});

test('confirmed two-day range keeps its year and a fixed source start time', () => {
  const photo = [{ title: 'Night Market at Town Hall', dateText: 'Nov 14–15', eventDate: '', eventTime: '', venue: 'Town Hall', place: 'Hamilton' }];
  const sourceUrl = 'https://organizer.example/night-market';
  const match = { index: 0, matchedTitle: 'Night Market at Town Hall', dateText: 'November 14–15, 2026', dateKind: 'range', eventDate: '', eventTime: '18:30', rangeStart: '2026-11-14', rangeEnd: '2026-11-15', venue: 'Town Hall', place: 'Hamilton', sourceUrl };
  const result = mergeWebDetails(photo, { matches: [match] }, new Set([sourceUrl]), '2026-11-08');
  assert.equal(result[0].dateText, 'Nov 14–15, 2026');
  assert.equal(result[0].eventDate, '');
  assert.equal(result[0].eventTime, '18:30');
});
