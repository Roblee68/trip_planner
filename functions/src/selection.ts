import type { Candidate, ScoutPick, ScoutRequest, ScoutResponse } from './contracts.js';

export function parseScoutRequest(value: unknown): ScoutRequest {
  if (!value || typeof value !== 'object') throw new Error('Request must be an object');
  const data = value as Record<string, unknown>;
  const prompt = typeof data.prompt === 'string' ? data.prompt.trim() : '';
  const place = typeof data.place === 'string' ? data.place.trim() : '';
  const currency = typeof data.currency === 'string' ? data.currency.trim().toUpperCase() : '';
  const latitude = data.latitude === undefined ? undefined : Number(data.latitude);
  const longitude = data.longitude === undefined ? undefined : Number(data.longitude);
  const maxBudget = Number(data.maxBudget);
  const maxDistanceKm = Number(data.maxDistanceKm);
  const interests = Array.isArray(data.interests) ? data.interests.filter((x): x is string => typeof x === 'string').slice(0, 12) : [];
  const refinement = ['balanced', 'different', 'cheaper', 'closer'].includes(String(data.refinement)) ? data.refinement as ScoutRequest['refinement'] : 'balanced';
  if (!prompt || prompt.length > 500 || place.length < 3 || place.length > 120 || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(maxBudget) || maxBudget < 0 || maxBudget > 10000 || !Number.isFinite(maxDistanceKm) || maxDistanceKm < 0 || maxDistanceKm > 500) throw new Error('Invalid discovery request');
  if ((latitude === undefined) !== (longitude === undefined) || (latitude !== undefined && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude! < -180 || longitude! > 180))) throw new Error('Invalid location');
  return { prompt, place, currency, latitude, longitude, maxBudget, maxDistanceKm, interests, refinement };
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function eligibleCandidates(items: Candidate[], request: ScoutRequest, now = new Date()): Candidate[] {
  const freeOnly = /\bfree\b|no cost|without spending/i.test(request.prompt);
  const statedBudget = request.prompt.match(/(?:under|below|up to|less than)\s*\$\s*(\d+)/i);
  const budget = freeOnly ? 0 : statedBudget ? Math.min(request.maxBudget, Number(statedBudget[1])) : request.maxBudget;
  const statedDistance = request.prompt.match(/(?:within|under|up to)\s*(\d+)\s*(?:km|kilometres?|kilometers?)/i);
  const radius = statedDistance ? Math.min(request.maxDistanceKm, Number(statedDistance[1])) : request.maxDistanceKm;
  const statedHours = request.prompt.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  const maxHours = statedHours ? Number(statedHours[1]) : Infinity;
  return items.flatMap(item => {
    const start = Date.parse(item.startsAt);
    if (item.status !== 'active' || !Number.isFinite(start) || start < now.getTime() || item.currency !== request.currency) return [];
    const samePlace = item.place.trim().toLowerCase() === request.place.trim().toLowerCase();
    const hasCoords = request.latitude !== undefined && request.longitude !== undefined && item.latitude !== undefined && item.longitude !== undefined;
    if (!samePlace && !hasCoords) return [];
    const actualDistance = hasCoords ? distanceKm(request.latitude!, request.longitude!, item.latitude!, item.longitude!) : item.distanceKm;
    if (item.totalCost > budget || actualDistance > radius || item.durationHours > maxHours) return [];
    if (item.mode === 'live') {
      const checked = item.verifiedAt ? Date.parse(item.verifiedAt) : NaN;
      if (!Number.isFinite(checked) || checked > now.getTime() || now.getTime() - checked > 48 * 60 * 60 * 1000) return [];
      if (!item.sourceUrl?.startsWith('https://')) return [];
    }
    return [{ ...item, distanceKm: actualDistance }];
  });
}

export function finalizeResponse(raw: { message: string; picks: { id: string; reason: string }[]; followUp: string | null }, allowed: Candidate[]): ScoutResponse {
  const byId = new Map(allowed.map(item => [item.id, item]));
  const seen = new Set<string>();
  const picks: ScoutPick[] = [];
  for (const suggestion of raw.picks) {
    const item = byId.get(suggestion.id);
    if (!item || seen.has(item.id) || picks.length === 3) continue;
    seen.add(item.id);
    picks.push({ id: item.id, title: item.title, category: item.category, summary: item.summary, startsAt: item.startsAt, durationHours: item.durationHours, totalCost: item.totalCost, currency: item.currency, distanceKm: item.distanceKm, location: item.location, sourceUrl: item.sourceUrl, verifiedAt: item.verifiedAt, mode: item.mode, reason: suggestion.reason.trim().slice(0, 180) });
  }
  return { message: raw.message.trim().slice(0, 260), picks, followUp: raw.followUp?.trim().slice(0, 140) || null, mode: allowed[0]?.mode ?? 'sample' };
}
