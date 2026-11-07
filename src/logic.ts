export type Category = 'Dance' | 'Outdoors' | 'Arts' | 'Food' | 'Learning' | 'Wellness';
import type { DistanceUnit } from './units.ts';
export const travelModes = ['walk', 'transit', 'train', 'car', 'plane', 'ferry', 'boat'] as const;
export type TravelMode = typeof travelModes[number];
export const travelModeLabels: Record<TravelMode, string> = { walk: 'Walking', transit: 'Transit', train: 'Trains', car: 'Cars', plane: 'Planes', ferry: 'Ferries', boat: 'Boats' };

export const interestTopics = [
  'Hiking', 'Epic views', 'Fairs', 'Markets', 'Antiques', 'Eating', 'Festivals', 'Holiday events',
  'Farms', 'Farm animals', 'Sports', 'Adrenaline', 'Play sports', 'Active', 'Shows', 'Musicals',
  'Theatre', 'Villages', 'Culture', 'Art', 'Museums', 'History', 'Archaeology', 'Paleontology',
  'Wild animals', 'Rare activities', 'Dancing', 'Classes', 'Crafts', 'Pottery',
  'Woodwork', 'Shopping', 'Handmade', 'Forests', 'Gardens', 'Waterfalls', 'Beaches',
  'Stargazing', 'Birdwatching', 'Farmers markets', 'Food tours', 'Cooking', 'Street food',
  'Coffee and tea', 'Live music', 'Comedy', 'Cinema', 'Photography', 'Architecture',
  'Books', 'Metalwork', 'Painting', 'Textiles', 'Jewellery making', 'Cycling',
  'Running', 'Paddling', 'Water sports', 'Winter sports', 'Climbing', 'Board games',
  'Trivia', 'Family activities', 'Volunteering', 'Community gatherings', 'Open to new ideas',
] as const;
export type InterestTopic = typeof interestTopics[number];
export const topicGroups: { label: string; topics: InterestTopic[] }[] = [
  { label: 'Nature and discovery', topics: ['Hiking', 'Forests', 'Gardens', 'Waterfalls', 'Beaches', 'Epic views', 'Stargazing', 'Birdwatching', 'Farms', 'Farm animals', 'Wild animals'] },
  { label: 'Food, markets and celebrations', topics: ['Fairs', 'Markets', 'Farmers markets', 'Antiques', 'Festivals', 'Holiday events', 'Eating', 'Food tours', 'Cooking', 'Street food', 'Coffee and tea'] },
  { label: 'Shows, culture and stories', topics: ['Shows', 'Musicals', 'Theatre', 'Live music', 'Comedy', 'Cinema', 'Books', 'Villages', 'Culture', 'Museums', 'History', 'Archaeology', 'Paleontology', 'Architecture'] },
  { label: 'Make, learn and browse', topics: ['Art', 'Dancing', 'Classes', 'Crafts', 'Pottery', 'Woodwork', 'Metalwork', 'Painting', 'Textiles', 'Jewellery making', 'Photography', 'Shopping', 'Handmade', 'Open to new ideas'] },
  { label: 'Sports and adventure', topics: ['Sports', 'Play sports', 'Active', 'Adrenaline', 'Cycling', 'Running', 'Paddling', 'Water sports', 'Winter sports', 'Climbing', 'Rare activities'] },
  { label: 'Together and community', topics: ['Board games', 'Trivia', 'Family activities', 'Volunteering', 'Community gatherings'] },
];
const topicTerms: Record<InterestTopic, string[]> = {
  Hiking: ['hike', 'hiking', 'trail'], Forests: ['forest', 'woodland', 'woods'],
  Gardens: ['garden', 'botanical'], Waterfalls: ['waterfall', 'falls'], Beaches: ['beach', 'coast'],
  Stargazing: ['stargazing', 'astronomy', 'night sky'], Birdwatching: ['birdwatching', 'birding', 'bird'],
  'Epic views': ['viewpoint', 'scenic', 'lookout', 'epic view'],
  Fairs: ['fair'], Markets: ['market'], Antiques: ['antique'], Eating: ['food', 'tasting', 'eat', 'dining'],
  Festivals: ['festival'], 'Holiday events': ['holiday', 'christmas', 'halloween', 'seasonal'],
  Farms: ['farm'], 'Farm animals': ['farm animal', 'petting zoo'], Sports: ['sport', 'game', 'match'],
  Adrenaline: ['adrenaline', 'thrill', 'climb', 'zipline'], 'Play sports': ['play sport', 'recreational sport', 'pickup game'],
  Active: ['active', 'walk', 'dance', 'hike'], Shows: ['show', 'performance'], Musicals: ['musical'],
  Theatre: ['theatre', 'theater', 'play'], Villages: ['village'], Culture: ['culture', 'cultural'],
  Art: ['art', 'sketch', 'pottery', 'printmaking', 'creative'], Museums: ['museum'], History: ['history', 'heritage'],
  Archaeology: ['archaeology', 'archaeological'], Paleontology: ['paleontology', 'fossil', 'dinosaur'],
  'Wild animals': ['wildlife', 'bird', 'animal safari'], 'Rare activities': ['rare', 'unusual', 'once in a lifetime'],
  Dancing: ['dance', 'dancing', 'ballroom', 'line dancing'], Classes: ['class', 'course', 'lesson', 'workshop'],
  Crafts: ['craft', 'making', 'hand-building'], Pottery: ['pottery', 'ceramic', 'clay'],
  Woodwork: ['woodwork', 'woodworking', 'carving', 'wood shop'], Shopping: ['shopping', 'shop', 'boutique', 'market'],
  Handmade: ['handmade', 'hand made', 'artisan', 'maker'],
  'Farmers markets': ['farmers market', 'farm market'], 'Food tours': ['food tour', 'culinary tour'],
  Cooking: ['cooking', 'cookery', 'cook'], 'Street food': ['street food', 'food truck'],
  'Coffee and tea': ['coffee', 'tea tasting', 'tea ceremony'],
  'Live music': ['live music', 'concert', 'gig'], Comedy: ['comedy', 'stand-up', 'improv'],
  Cinema: ['cinema', 'film', 'movie'], Photography: ['photography', 'photo walk'],
  Architecture: ['architecture', 'architectural'], Books: ['book', 'literary', 'reading'],
  Metalwork: ['metalwork', 'metalworking', 'blacksmith', 'forge'],
  Painting: ['painting', 'watercolour', 'watercolor'], Textiles: ['textile', 'weaving', 'sewing'],
  'Jewellery making': ['jewellery', 'jewelry', 'silversmith'], Cycling: ['cycling', 'bike ride'],
  Running: ['running', 'run club'], Paddling: ['paddling', 'kayak', 'canoe'],
  'Water sports': ['water sport', 'surfing', 'sailing'], 'Winter sports': ['skiing', 'skating', 'snowshoe'],
  Climbing: ['climbing', 'bouldering'], 'Board games': ['board game', 'tabletop'],
  Trivia: ['trivia', 'quiz night'], 'Family activities': ['family activity', 'family friendly'],
  Volunteering: ['volunteer', 'community service'], 'Community gatherings': ['community gathering', 'meetup', 'social club'],
  'Open to new ideas': [],
};
export function matchedTopics(item: Experience, topics: InterestTopic[]): InterestTopic[] {
  const words = `${item.title} ${item.summary} ${item.tags.join(' ')}`.toLowerCase();
  return topics.filter(topic => (topicTerms[topic] ?? []).some(term => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(words)));
}
export type Experience = {
  travel?: { modes: TravelMode[]; originPlace?: string; flightMinutes?: number; routeSourceUrl?: string; routeCheckedAt?: string };
  id: string;
  title: string;
  category: Category;
  format: string;
  summary: string;
  location: string;
  place?: string;
  distanceKm: number;
  totalCost: number;
  durationHours: number;
  startsAt: string;
  signupBy?: string;
  status?: 'active' | 'full' | 'cancelled';
  listedAt: string;
  tags: string[];
  alongWay: boolean;
  accent: string;
  sourceUrl?: string;
  verifiedAt?: string;
  currency?: string;
  mode?: 'sample' | 'live';
};
export type Feedback = Record<string, 'love' | 'pass'>;
export type Preferences = {
  interests: Category[];
  topics: InterestTopic[];
  travelModes: TravelMode[];
  place: string;
  currency: string;
  distanceUnit: DistanceUnit;
  maxBudget: number;
  maxDistanceKm: number;
  alertsEnabled: boolean;
  freeAlerts: boolean;
  savedAlerts: boolean;
  phoneAlertsEnabled: boolean;
  dailyScoutEnabled: boolean;
};

export const categories: Category[] = ['Dance', 'Outdoors', 'Arts', 'Food', 'Learning', 'Wellness'];

export const defaultPreferences: Preferences = {
  interests: ['Dance', 'Arts', 'Outdoors'],
  topics: [],
  travelModes: ['walk', 'transit', 'train', 'car'],
  place: 'Toronto, Canada',
  currency: 'CAD',
  distanceUnit: 'km',
  maxBudget: 100,
  maxDistanceKm: 30,
  alertsEnabled: true,
  freeAlerts: true,
  savedAlerts: true,
  phoneAlertsEnabled: false,
  dailyScoutEnabled: false,
};

export function daysFromNow(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function daysUntil(date: string, now = new Date()): number {
  return Math.ceil((new Date(date).getTime() - now.getTime()) / 86_400_000);
}

export function withinLimits(item: Experience, preferences: Preferences): boolean {
  return (item.currency ?? 'CAD') === preferences.currency && item.totalCost <= preferences.maxBudget && item.distanceKm <= preferences.maxDistanceKm;
}

export function score(item: Experience, preferences: Preferences, feedback: Feedback, savedIds: string[], items: Experience[] = []): number {
  const interests = preferences.interests.includes(item.category) ? 35 : 5;
  const specific = Math.min(3, matchedTopics(item, preferences.topics ?? []).length) * 18;
  const discovery = preferences.topics?.includes('Open to new ideas') && !preferences.interests.includes(item.category) ? 18 : 0;
  const practical = withinLimits(item, preferences) ? 25 : -50;
  const free = item.totalCost === 0 ? 8 : 0;
  const soon = daysUntil(item.startsAt) <= 14 ? 9 : 0;
  const categoryFeedback = items.filter(other => other.category === item.category && other.id !== item.id);
  const love = categoryFeedback.filter(other => feedback[other.id] === 'love').length;
  const pass = categoryFeedback.filter(other => feedback[other.id] === 'pass').length;
  const preferenceSignal = love * 12 - pass * 12;
  const saved = savedIds.includes(item.id) ? 6 : 0;
  return interests + specific + discovery + practical + free + soon + preferenceSignal + saved;
}

export function rankExperiences(items: Experience[], preferences: Preferences, feedback: Feedback, savedIds: string[]): Experience[] {
  return items
    .filter(item => item.status !== 'full' && item.status !== 'cancelled' && withinLimits(item, preferences) && (!item.travel || item.travel.modes.some(mode => (preferences.travelModes ?? []).includes(mode))) && feedback[item.id] !== 'pass' && daysUntil(item.startsAt) >= 0)
    .sort((a, b) => score(b, preferences, feedback, savedIds, items) - score(a, preferences, feedback, savedIds, items));
}

export type OpportunityAlert = {
  item: Experience;
  reason: string;
  priority: number;
};

export function opportunityAlerts(items: Experience[], preferences: Preferences, feedback: Feedback, savedIds: string[], now = new Date()): OpportunityAlert[] {
  if (!preferences.alertsEnabled) return [];
  return items.flatMap(item => {
    const days = daysUntil(item.startsAt, now);
    const age = (now.getTime() - new Date(item.listedAt).getTime()) / 86_400_000;
    const verificationAge = item.verifiedAt ? (now.getTime() - new Date(item.verifiedAt).getTime()) / 86_400_000 : Infinity;
    const signupSoon = item.signupBy ? Date.parse(item.signupBy) > now.getTime() && Date.parse(item.signupBy) - now.getTime() <= 7 * 86_400_000 : false;
    const watched = preferences.savedAlerts && savedIds.includes(item.id);
    const relevant = preferences.interests.includes(item.category) || matchedTopics(item, preferences.topics ?? []).length > 0 || watched;
    if (!relevant || item.status === 'full' || item.status === 'cancelled' || !withinLimits(item, preferences) || (item.travel && !item.travel.modes.some(mode => (preferences.travelModes ?? []).includes(mode))) || feedback[item.id] === 'pass' || days < 0 || days > 21 || age < 0 || age > 7) return [];
    if (item.mode === 'live' && (!item.sourceUrl?.startsWith('https://') || verificationAge < 0 || verificationAge > 2)) return [];
    const isFree = preferences.freeAlerts && item.totalCost === 0;
    const reason = signupSoon ? 'Sign-up deadline approaching' : watched ? 'A saved interest has a new date' : isFree ? 'A free opportunity in your interests' : 'New and starting soon';
    return [{ item, reason, priority: (signupSoon ? 40 : 0) + (watched ? 30 : 0) + (isFree ? 20 : 0) + (21 - days) }];
  }).sort((a, b) => b.priority - a.priority);
}

export function money(amount: number, currency = 'CAD'): string { return amount === 0 ? 'Free' : `${amount} ${currency}`; }
