export type Candidate = {
  id: string;
  title: string;
  category: string;
  summary: string;
  startsAt: string;
  durationHours: number;
  totalCost: number;
  distanceKm: number;
  location: string;
  place: string;
  currency: string;
  latitude?: number;
  longitude?: number;
  sourceUrl: string | null;
  verifiedAt: string | null;
  status: 'active' | 'cancelled' | 'full';
  mode: 'sample' | 'live';
};

export type ScoutRequest = {
  prompt: string;
  place: string;
  currency: string;
  latitude?: number;
  longitude?: number;
  maxBudget: number;
  maxDistanceKm: number;
  interests: string[];
  refinement: 'balanced' | 'different' | 'cheaper' | 'closer';
};

export type ScoutPick = {
  id: string;
  title: string;
  category: string;
  summary: string;
  startsAt: string;
  durationHours: number;
  totalCost: number;
  currency: string;
  distanceKm: number;
  location: string;
  sourceUrl: string | null;
  verifiedAt: string | null;
  mode: 'sample' | 'live';
  reason: string;
};

export type ScoutResponse = {
  message: string;
  picks: ScoutPick[];
  followUp: string | null;
  mode: 'sample' | 'live';
};
