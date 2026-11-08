import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLocalDateTime, reminderSuggestion, safeSourceUrl } from '../src/importedFinds.ts';

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
