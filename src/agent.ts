import { daysUntil, type Category, type Experience, type Feedback, type Preferences } from './logic.ts';
import { formatDistance, toKilometres } from './units.ts';

export type Intent = {
  budget?: number;
  distanceKm?: number;
  durationHours?: number;
  category?: Category;
  freeOnly: boolean;
  soon: boolean;
  surprise: boolean;
  keywords: string[];
};
export type DiscoveryMode = 'balanced' | 'different' | 'cheaper' | 'closer';
export type Suggestion = { item: Experience; reasons: string[]; score: number };

const categoryTerms: Record<Category, string[]> = {
  Dance: ['dance', 'dancing', 'ballroom', 'salsa', 'line dance', 'swing'],
  Outdoors: ['outdoor', 'outside', 'nature', 'hike', 'walk', 'bird', 'forest', 'park'],
  Arts: ['art', 'creative', 'paint', 'pottery', 'ceramic', 'sketch', 'gallery'],
  Food: ['food', 'eat', 'dinner', 'market', 'cooking', 'tasting'],
  Learning: ['learn', 'class', 'course', 'workshop', 'skill', 'make'],
  Wellness: ['wellness', 'relax', 'calm', 'gentle', 'mindful', 'yoga'],
};
const filler = new Set(['i', 'me', 'my', 'a', 'an', 'the', 'and', 'or', 'to', 'for', 'with', 'want', 'would', 'like', 'something', 'thing', 'do', 'try', 'this', 'that', 'have', 'hours', 'hour', 'under', 'less', 'than', 'near', 'nearby', 'today', 'tomorrow', 'weekend', 'free', 'fun', 'new']);

export function interpretIntent(input: string): Intent {
  const text = input.trim().toLowerCase();
  const money = text.match(/(?:under|below|up to|less than|budget of)?\s*\$\s*(\d+)/);
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/);
  const distance = text.match(/(?:within|under|up to)?\s*(\d+(?:\.\d+)?)\s*(km|kilometres?|kilometers?|mi|miles?)/);
  const category = (Object.keys(categoryTerms) as Category[]).find(key => categoryTerms[key].some(term => text.includes(term)));
  const keywords = text.replace(/\$\s*\d+|\d+(?:\.\d+)?\s*(?:hours?|hrs?|km|kilometres?|kilometers?|mi|miles?)/g, ' ').split(/[^a-z]+/).filter(word => word.length > 2 && !filler.has(word));
  return {
    budget: money ? Number(money[1]) : undefined,
    distanceKm: distance ? toKilometres(Number(distance[1]), /^mi/.test(distance[2]) ? 'mi' : 'km') : /nearby|close to me|not far/.test(text) ? 15 : undefined,
    durationHours: hours ? Number(hours[1]) : undefined,
    category,
    freeOnly: /\bfree\b|no cost|without spending/.test(text),
    soon: /today|tomorrow|tonight|this weekend|soon/.test(text),
    surprise: /surprise|different|unusual|unexpected|new to me/.test(text),
    keywords,
  };
}

export function recommendForIntent(items: Experience[], preferences: Preferences, feedback: Feedback, savedIds: string[], intent: Intent, mode: DiscoveryMode = 'balanced', now = new Date()): Suggestion[] {
  const budget = intent.freeOnly ? 0 : intent.budget ?? preferences.maxBudget;
  const radius = intent.distanceKm ?? preferences.maxDistanceKm;
  return items.flatMap(item => {
    const days = daysUntil(item.startsAt, now);
    if (feedback[item.id] === 'pass' || item.totalCost > budget || item.distanceKm > radius || days < 0) return [];
    if (intent.durationHours !== undefined && item.durationHours > intent.durationHours) return [];
    if (intent.soon && days > 7) return [];
    const searchable = `${item.title} ${item.summary} ${item.tags.join(' ')} ${item.category}`.toLowerCase();
    const keywordHits = intent.keywords.filter(word => searchable.includes(word)).length;
    const categoryMatch = intent.category === item.category;
    const interested = preferences.interests.includes(item.category);
    const explore = mode === 'different' || intent.surprise;
    const score = (categoryMatch && mode !== 'different' ? 80 : 0) + (mode === 'different' ? 0 : keywordHits * 15) + (explore ? interested ? 0 : 55 : interested ? 24 : 0)
      + (item.totalCost === 0 ? 6 : 0) + (days <= 7 ? 8 : 0) + (savedIds.includes(item.id) ? 4 : 0)
      + (feedback[item.id] === 'love' ? 12 : 0)
      + (mode === 'cheaper' ? Math.max(0, budget - item.totalCost) / 3 : 0)
      + (mode === 'closer' ? Math.max(0, radius - item.distanceKm) : 0);
    const reasons = [categoryMatch ? `Matches your interest in ${item.category.toLowerCase()}` : interested ? `Fits your ${item.category.toLowerCase()} interest` : 'A fresh direction to explore'];
    if (item.totalCost === 0) reasons.push('Free to try'); else reasons.push(`Within your $${budget} budget`);
    if (days <= 7) reasons.push(days === 0 ? 'Happening today' : `Starting in ${days} days`);
    else reasons.push(`${formatDistance(item.distanceKm, preferences.distanceUnit)} from Toronto`);
    return [{ item, reasons, score }];
  }).sort((a, b) => b.score - a.score || a.item.distanceKm - b.item.distanceKm);
}
