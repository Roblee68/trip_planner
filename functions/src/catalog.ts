import { getFirestore } from 'firebase-admin/firestore';
import type { Candidate, ScoutRequest } from './contracts.js';

const daysAhead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const sampleCatalog = (): Candidate[] => [
  { id: 'line-dance', title: 'Free intro to line dancing', category: 'Dance', summary: 'An introductory dance lesson.', startsAt: daysAhead(5), durationHours: 1, totalCost: 0, currency: 'CAD', distanceKm: 5, location: 'Downtown Toronto', place: 'Toronto, Canada', sourceUrl: null, verifiedAt: null, status: 'active', mode: 'sample' },
  { id: 'ballroom', title: 'Beginner ballroom: six-week series', category: 'Dance', summary: 'Beginner ballroom course.', startsAt: daysAhead(14), durationHours: 1.5, totalCost: 95, currency: 'CAD', distanceKm: 8, location: 'West Toronto', place: 'Toronto, Canada', sourceUrl: null, verifiedAt: null, status: 'active', mode: 'sample' },
  { id: 'pottery', title: 'Make your own ceramic mug', category: 'Arts', summary: 'Introductory hand-building workshop.', startsAt: daysAhead(10), durationHours: 2, totalCost: 48, currency: 'CAD', distanceKm: 9, location: 'The Junction', place: 'Toronto, Canada', sourceUrl: null, verifiedAt: null, status: 'active', mode: 'sample' },
  { id: 'birdwalk', title: 'Sunrise birding walk', category: 'Outdoors', summary: 'Guided local nature walk.', startsAt: daysAhead(7), durationHours: 2, totalCost: 12, currency: 'CAD', distanceKm: 12, location: 'Humber River', place: 'Toronto, Canada', sourceUrl: null, verifiedAt: null, status: 'active', mode: 'sample' },
  { id: 'sketch-walk', title: 'Neighbourhood sketch walk', category: 'Arts', summary: 'A relaxed creative walk.', startsAt: daysAhead(1), durationHours: 1, totalCost: 0, currency: 'CAD', distanceKm: 7, location: 'High Park', place: 'Toronto, Canada', sourceUrl: null, verifiedAt: null, status: 'active', mode: 'sample' },
];

function fromRecord(id: string, value: Record<string, unknown>): Candidate | null {
  const text = (key: string) => typeof value[key] === 'string' ? value[key] as string : '';
  const number = (key: string) => typeof value[key] === 'number' && Number.isFinite(value[key]) ? value[key] as number : NaN;
  const url = text('sourceUrl');
  const candidate: Candidate = {
    id, title: text('title'), category: text('category'), summary: text('summary'), startsAt: text('startsAt'),
    durationHours: number('durationHours'), totalCost: number('totalCost'), currency: text('currency').toUpperCase(),
    distanceKm: number('distanceKm'), location: text('location'), place: text('place'),
    latitude: Number.isFinite(number('latitude')) ? number('latitude') : undefined,
    longitude: Number.isFinite(number('longitude')) ? number('longitude') : undefined,
    sourceUrl: url || null, verifiedAt: text('verifiedAt') || null,
    status: text('status') as Candidate['status'], mode: 'live',
  };
  if (!candidate.title || !candidate.place || !candidate.location || !Number.isFinite(Date.parse(candidate.startsAt)) || !Number.isFinite(candidate.totalCost) || !Number.isFinite(candidate.distanceKm) || !Number.isFinite(candidate.durationHours) || !/^[A-Z]{3}$/.test(candidate.currency) || !['active', 'cancelled', 'full'].includes(candidate.status)) return null;
  return candidate;
}

export async function loadCandidates(request: ScoutRequest): Promise<Candidate[]> {
  if (process.env.PBB_CATALOG_MODE !== 'firestore') return sampleCatalog();
  const placeKey = request.place.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
  const snapshot = await getFirestore().collection('events').where('placeKey', '==', placeKey).where('startsAt', '>=', new Date().toISOString()).orderBy('startsAt').limit(150).get();
  return snapshot.docs.flatMap(doc => { const candidate = fromRecord(doc.id, doc.data()); return candidate ? [candidate] : []; });
}
