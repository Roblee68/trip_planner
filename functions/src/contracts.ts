export type Candidate = {
  id: string;
  title: string;
  category: string;
  summary: string;
  listedAt: string;
  startsAt: string;
  signupBy?: string | null;
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
  topics?: string[];
  travelModes?: string[];
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
  topics: string[];
  travelModes: string[];
  likedExamples?: string[];
  refinement: 'balanced' | 'different' | 'cheaper' | 'closer';
  occasion?: 'today' | 'route' | 'surprise' | 'discover' | 'any';
  localDate?: string;
  localTime?: string;
  timeAvailableHours?: number;
  routeDestination?: string;
  routeStyle?: 'highway' | 'towns' | 'either';
  routeVia?: string;
  detourMinutes?: number;
  routeTiming?: 'today' | 'weekend' | 'flexible';
};

export type ScoutPick = {
  id: string;
  title: string;
  category: string;
  summary: string;
  listedAt: string;
  startsAt: string;
  signupBy?: string | null;
  durationHours: number;
  totalCost: number;
  currency: string;
  distanceKm: number;
  location: string;
  place: string;
  sourceUrl: string | null;
  verifiedAt: string | null;
  mode: 'sample' | 'live';
  status: 'active' | 'full' | 'cancelled';
  reason: string;
};

export type WebIdea = {
  id: string;
  title: string;
  summary: string;
  reason: string;
  dateText: string;
  eventDate?: string;
  priceText: string;
  venue: string;
  address: string | null;
  place: string;
  sourceUrl: string;
  foundAt: string;
};

export type ScoutResponse = {
  message: string;
  picks: ScoutPick[];
  followUp: string | null;
  mode: 'sample' | 'live' | 'web';
  citations?: { startIndex: number; endIndex: number; url: string; title: string }[];
  ideas?: WebIdea[];
};
