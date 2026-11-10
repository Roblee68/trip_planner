import type { Category } from './logic';
import type { WebIdea, WeeklyLocalEvent } from './remoteScout';

function includesEveryWord(text: string, query: string): boolean {
  const normalized = text.toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => !word || normalized.includes(word));
}

function fitsCategory(category: Category | 'All', eventCategory: string, text: string): boolean {
  if (category === 'All') return true;
  const words = text.toLocaleLowerCase();
  if (category === 'Dance') return /\b(danc\w*|ballroom|salsa|tango|ballet|swing)\b/.test(words);
  if (category === 'Outdoors') return eventCategory === 'outdoors' || /\b(hik\w*|trail\w*|forest\w*|nature|garden\w*|park\w*)\b/.test(words);
  if (category === 'Arts') return ['arts', 'theatre', 'music'].includes(eventCategory) || /\b(art\w*|museum\w*|exhibit\w*|concert\w*|theatre|theater)\b/.test(words);
  if (category === 'Food') return ['food', 'markets'].includes(eventCategory) || /\b(food|cook\w*|tast\w*|dining|restaurant\w*|market\w*)\b/.test(words);
  if (category === 'Learning') return eventCategory === 'classes' || /\b(class\w*|workshop\w*|lesson\w*|learn\w*|lecture\w*)\b/.test(words);
  return eventCategory === 'sports' || /\b(yoga|wellness|meditat\w*|fitness|spa|mindful\w*)\b/.test(words);
}

export function weeklyEventMatches(event: WeeklyLocalEvent, query: string, category: Category | 'All'): boolean {
  const text = `${event.title} ${event.category} ${event.place} ${event.sourceName}`;
  return includesEveryWord(text, query) && fitsCategory(category, event.category, text);
}

export function webIdeaMatches(idea: WebIdea, query: string, category: Category | 'All'): boolean {
  const text = `${idea.title} ${idea.summary} ${idea.venue} ${idea.place} ${idea.reason}`;
  return includesEveryWord(text, query) && fitsCategory(category, '', text);
}
