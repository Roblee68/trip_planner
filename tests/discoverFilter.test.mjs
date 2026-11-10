import assert from 'node:assert/strict';
import test from 'node:test';
import { weeklyEventMatches, webIdeaMatches } from '../src/discoverFilter.ts';

test('Discover search finds current weekly events by title and category', () => {
  const event = { title: 'Beginner ballroom dance lesson', category: 'classes', place: 'Hamilton, Canada', sourceName: 'dance.example' };
  assert.equal(weeklyEventMatches(event, 'ballroom', 'All'), true);
  assert.equal(weeklyEventMatches(event, 'ballroom', 'Dance'), true);
  assert.equal(weeklyEventMatches(event, 'hiking', 'All'), false);
  assert.equal(weeklyEventMatches(event, '', 'Food'), false);
});

test('Discover search includes web ideas and applies all query words', () => {
  const idea = { title: 'Forest pottery workshop', summary: 'Make a bowl beside the woods', venue: 'Craft Barn', place: 'Hamilton, Canada', reason: 'Matches pottery' };
  assert.equal(webIdeaMatches(idea, 'forest pottery', 'All'), true);
  assert.equal(webIdeaMatches(idea, 'pottery swimming', 'All'), false);
  assert.equal(webIdeaMatches(idea, '', 'Learning'), true);
});
