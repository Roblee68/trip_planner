import assert from 'node:assert/strict';
import test from 'node:test';
import { findMentionsArea, mergeSelectedFinds, orderFindsForArea, parseLocalDateTime, reminderSuggestion, safeSourceUrl } from '../src/importedFinds.ts';

test('calendar and reminder dates reject invalid or nonexistent local times', () => {
  assert.equal(parseLocalDateTime('2026-02-30', '09:00'), null);
  assert.equal(parseLocalDateTime('2026-11-08', '25:00'), null);
  assert.equal(parseLocalDateTime('2026-11-08', '09:30')?.getDate(), 8);
});

test('suggested reminder stays before a confirmed event', () => {
  const reminder = reminderSuggestion('2026-11-20', '19:00', 3);
  assert.equal(reminder?.getDate(), 17);
  assert.equal(reminder?.getHours(), 19);
});

test('an imported source must be a plain HTTPS URL', () => {
  assert.equal(safeSourceUrl('javascript:alert(1)'), null);
  assert.equal(safeSourceUrl('http://instagram.com/p/example'), null);
  assert.equal(safeSourceUrl('https://instagram.com/p/example')?.startsWith('https://'), true);
});

test('area hint uses the listed place before headline text', () => {
  const find = { title: 'Toronto themed market', venue: 'Village Hall', place: 'Hamilton', dateText: '', eventDate: '', eventTime: '' };
  assert.equal(findMentionsArea(find, 'Toronto, Canada'), false);
  assert.equal(findMentionsArea({ ...find, place: 'Toronto, Ontario' }, 'Toronto, Canada'), true);
  assert.equal(findMentionsArea({ ...find, place: '' }, 'Toronto, Canada'), true);
});

test('selected lookup enriches only its original row without moving it', () => {
  const first = { title: 'A Christmas market', venue: '', place: 'Toronto', dateText: 'Nov 20', eventDate: '', eventTime: '' };
  const second = { title: 'Winter craft show', venue: '', place: 'Hamilton', dateText: 'Nov 21', eventDate: '', eventTime: '' };
  const ordered = orderFindsForArea([second, first], 'Toronto, Canada');
  assert.deepEqual(ordered.map(find => find.title), ['A Christmas market', 'Winter craft show']);

  const result = mergeSelectedFinds(ordered, [1], [{ ...second, title: 'Official Winter Makers Fair', sourceUrl: 'https://example.org/fair', place: 'Toronto' }]);
  assert.deepEqual(result.map(find => find.title), ['A Christmas market', 'Winter craft show']);
  assert.equal(result[1].sourceTitle, 'Official Winter Makers Fair');
  assert.equal(result[1].sourceUrl, 'https://example.org/fair');
  assert.equal(result[0], ordered[0]);
});
