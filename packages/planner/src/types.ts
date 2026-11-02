// Shared domain types for Raahi. Plain data in, plain data out — no I/O anywhere in this package.

export const CATEGORIES = [
  'heritage', 'fort', 'palace', 'temple', 'monastery', 'church', 'mosque', 'spiritual',
  'nature', 'viewpoint', 'lake', 'beach', 'waterfall', 'wildlife', 'trek', 'adventure',
  'market', 'museum', 'garden', 'village', 'food', 'culture', 'nightlife', 'cave', 'island',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const REGIONS = ['North', 'Himalaya', 'West', 'Central', 'East', 'Northeast', 'South', 'Islands'] as const;
export type Region = (typeof REGIONS)[number];

export const TERRAINS = ['city', 'hills', 'mountains', 'coast', 'plains', 'desert', 'islands'] as const;
export type Terrain = (typeof TERRAINS)[number];

export const DEST_TYPES = [
  'mountains', 'hills', 'beach', 'heritage', 'spiritual', 'wildlife', 'city',
  'desert', 'backwaters', 'adventure', 'lakes', 'islands', 'snow', 'offbeat',
] as const;
export type DestType = (typeof DEST_TYPES)[number];

export interface Place {
  id: string;
  destinationId: string;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  /** Typical time spent at the place, minutes. */
  visitMins: number;
  /** Entry fee for one Indian adult, ₹ (0 = free). Approximate. */
  fee: number;
  /** "HH:MM-HH:MM" or "24h". */
  open: string;
  /** Weekdays closed, 0 = Sunday … 6 = Saturday. */
  closedDays: number[];
  /** Months the place is accessible (1–12); null = all year. */
  months: number[] | null;
  /** Raahi's curated quality score, 1–10 (not user reviews). */
  score: number;
  /** How well known / crowded, 1 (almost nobody) – 10 (everyone goes). */
  popularity: number;
  description: string;
  tip?: string;
  /** Wikipedia article title, used to find real photos. */
  wiki?: string;
  /** Search words for Wikimedia Commons when there is no article. */
  photoQuery?: string;
  avoidKids: boolean;
  avoidElders: boolean;
  /** Best at evening / night. */
  evening: boolean;
  source: 'curated' | 'community';
}

export interface Festival { name: string; month: number; }

export interface Road {
  from: string; // place id or 'hub'
  to: string;
  km: number;
  mins: number;
  /** Months the road is open; omitted = all year. */
  months?: number[];
}

export interface Destination {
  id: string;
  name: string;
  state: string;
  region: Region;
  types: DestType[];
  lat: number;
  lng: number;
  bestMonths: number[];
  idealDays: [number, number];
  terrain: Terrain;
  /** Food per person per day, ₹ (mid-range). */
  foodPerDay: number;
  /** One mid-range double room per night, ₹. */
  stayPerNight: number;
  tagline: string;
  about: string;
  /** People, homes, traditions, daily life. */
  people: string;
  dishes: string[];
  festivals: Festival[];
  language: string;
  gettingThere: string;
  wiki?: string;
  photoQuery?: string;
  popularity: number;
  altitude?: number;
  /** Default start point: town centre, main market or where most people stay. */
  hub: { name: string; lat: number; lng: number };
  /** Optional explicit road network (seasonal passes etc.). When present, only these roads are used. */
  roads?: Road[];
}

export interface Dataset { destinations: Destination[]; places: Place[]; }

export type Companions = 'solo' | 'couple' | 'friends' | 'family';
export type Pace = 'relaxed' | 'balanced' | 'packed';
export type BudgetType = 'per_person' | 'total';

export const INTERESTS = [
  'heritage', 'spiritual', 'nature', 'views', 'water', 'adventure',
  'wildlife', 'food', 'culture', 'nightlife', 'museums',
] as const;
export type Interest = (typeof INTERESTS)[number];

export interface PlanRequest {
  destinations: string[];
  startDate: string; // YYYY-MM-DD
  days: number; // 1–14
  dayStart: string; // HH:MM
  dayEnd: string; // HH:MM
  startPoint?: { name: string; lat: number; lng: number } | null;
  budget: number;
  budgetType: BudgetType;
  companions: Companions;
  people: number;
  kids: boolean;
  elders: boolean;
  interests: Interest[];
  pace: Pace;
  /** 0 = popular classics, 100 = off-beat. */
  discovery: number;
  includeStay: boolean;
  mustInclude: string[];
  exclude: string[];
  /** Place ids from a previous plan, to produce a genuinely different one. */
  avoid: string[];
}

export type TimelineItem =
  | { type: 'start'; time: number; name: string }
  | { type: 'travel'; from: string; to: string; start: number; end: number; km: number; mins: number; cost: number; mode: string }
  | { type: 'visit'; placeId: string; start: number; end: number; wait: number; fee: number; why: string; /** outside the normal day */ extra?: 'early' | 'late' }
  | { type: 'meal'; start: number; end: number; label: string }
  | { type: 'end'; time: number; name: string };

export interface DayPlan {
  index: number;
  date: string;
  destinationId: string;
  base: { name: string; lat: number; lng: number };
  items: TimelineItem[];
  placeIds: string[];
  km: number;
  travelMins: number;
  note?: string;
}

export interface LeftOut {
  placeId: string;
  reason: 'closed_season' | 'closed_day' | 'road_closed' | 'not_suitable' | 'interest' | 'over_budget' | 'no_time' | 'timing' | 'too_far' | 'excluded' | 'lower_value';
  detail: string;
}

export interface PipelineStep { step: string; count: number; note: string; algorithm?: string }

export interface PlanResult {
  feasible: boolean;
  infeasibleReason?: string;
  minBudget?: number;
  request: PlanRequest;
  title: string;
  days: DayPlan[];
  totals: {
    value: number;
    places: number;
    km: number;
    travelMins: number;
    people: number;
    budgetTotal: number;
    cost: { entry: number; transport: number; food: number; stay: number; intercity: number; total: number };
  };
  /** Every place in the itinerary, in order (used to compare plans when the traveller asks for another one). */
  placeIds: string[];
  allocation?: { destinationId: string; days: number; value: number }[];
  leftOut: LeftOut[];
  warnings: string[];
  pipeline: PipelineStep[];
  stats: {
    graphNodes: number;
    graphEdges: number;
    dpCells: number;
    floydMs: number;
    dijkstraMs: number;
    knapsackMs: number;
    totalMs: number;
  };
}
