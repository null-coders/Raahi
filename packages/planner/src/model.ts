// The "rules of the road": how Raahi turns a traveller's situation into numbers.
// Kept in one file so every weight is easy to find, explain and tune.

import type { Category, Companions, Destination, Interest, Pace, Place, PlanRequest, Terrain } from './types';

// ---------- time & dates ----------
export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const fmtTime = (mins: number): string => {
  const m = Math.round(mins);
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm.toString().padStart(2, '0')} ${ampm}`;
};
export const fmtDuration = (mins: number): string => {
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
};
export const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekday = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();
export const monthOf = (iso: string): number => Number(iso.slice(5, 7));
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Opening window in minutes; "24h" = whole day. */
export function openWindow(open: string): { from: number; to: number } {
  if (!open || open === '24h') return { from: 0, to: 24 * 60 };
  const [a, b] = open.split('-');
  const from = toMin(a), to = toMin(b);
  return { from, to: to <= from ? to + 24 * 60 : to };
}

// ---------- travel ----------
/** Average road speed (km/h) and how much longer roads are than a straight line, by terrain. */
export const TERRAIN_MODEL: Record<Terrain, { speed: number; roadFactor: number }> = {
  city: { speed: 20, roadFactor: 1.35 },
  hills: { speed: 24, roadFactor: 1.55 },
  mountains: { speed: 27, roadFactor: 1.6 },
  coast: { speed: 30, roadFactor: 1.35 },
  plains: { speed: 34, roadFactor: 1.3 },
  desert: { speed: 40, roadFactor: 1.25 },
  islands: { speed: 22, roadFactor: 1.4 },
};

export function roadKm(straightKm: number, terrain: Terrain): number {
  return straightKm * TERRAIN_MODEL[terrain].roadFactor;
}
export function driveMins(km: number, terrain: Terrain): number {
  return (km / TERRAIN_MODEL[terrain].speed) * 60 + (km > 0.4 ? 6 : 0);
}
/** Under ~1.2 km, people walk. */
export const WALK_KM = 1.2;
export const walkMins = (km: number) => (km / 4.2) * 60;

export interface TransportMode { label: string; perKm: number; vehicles: number }

export function transportMode(req: Pick<PlanRequest, 'companions' | 'people'>, terrain: Terrain): TransportMode {
  const hilly = terrain === 'hills' || terrain === 'mountains';
  if (req.people === 1 && !hilly) return { label: 'Auto / bike taxi', perKm: 14, vehicles: 1 };
  if (req.people <= 4) return { label: hilly ? 'Hired taxi' : 'Cab', perKm: hilly ? 22 : 16, vehicles: 1 };
  const vehicles = Math.ceil(req.people / 6);
  return { label: vehicles > 1 ? `${vehicles} SUVs` : 'SUV', perKm: hilly ? 26 : 21, vehicles };
}

// ---------- pace ----------
export const PACE: Record<Pace, { visit: number; buffer: number; lunch: number }> = {
  relaxed: { visit: 1.25, buffer: 20, lunch: 75 },
  balanced: { visit: 1.0, buffer: 12, lunch: 60 },
  packed: { visit: 0.85, buffer: 8, lunch: 45 },
};

// ---------- interests & companions ----------
export const INTEREST_CATEGORIES: Record<Interest, Category[]> = {
  heritage: ['heritage', 'fort', 'palace', 'cave'],
  spiritual: ['temple', 'monastery', 'church', 'mosque', 'spiritual'],
  nature: ['nature', 'garden', 'waterfall', 'lake', 'viewpoint', 'wildlife'],
  views: ['viewpoint', 'lake', 'trek'],
  water: ['lake', 'beach', 'waterfall', 'island'],
  adventure: ['adventure', 'trek'],
  wildlife: ['wildlife'],
  food: ['food', 'market'],
  culture: ['village', 'culture', 'market', 'museum'],
  nightlife: ['nightlife'],
  museums: ['museum', 'heritage'],
};

export const INTEREST_LABEL: Record<Interest, string> = {
  heritage: 'Heritage', spiritual: 'Spiritual', nature: 'Nature', views: 'Viewpoints', water: 'Lakes & beaches',
  adventure: 'Adventure', wildlife: 'Wildlife', food: 'Food & markets', culture: 'Local life', nightlife: 'Nightlife',
  museums: 'Museums',
};

const W = (o: Partial<Record<Category, number>>) => o;
export const COMPANION_WEIGHT: Record<Companions, Partial<Record<Category, number>>> = {
  solo: W({ trek: 1.2, adventure: 1.15, village: 1.2, culture: 1.15, food: 1.15, market: 1.1, monastery: 1.1, cave: 1.1 }),
  couple: W({ viewpoint: 1.25, lake: 1.2, beach: 1.2, garden: 1.15, palace: 1.15, island: 1.2, nightlife: 1.05, waterfall: 1.1 }),
  friends: W({ adventure: 1.3, trek: 1.25, nightlife: 1.3, beach: 1.2, food: 1.15, market: 1.1, waterfall: 1.1 }),
  family: W({ temple: 1.1, garden: 1.2, museum: 1.15, wildlife: 1.25, palace: 1.15, fort: 1.1, lake: 1.1, nightlife: 0.4, trek: 0.75, adventure: 0.85 }),
};

export function isGem(p: Pick<Place, 'score' | 'popularity'>): boolean {
  return p.score >= 8 && p.popularity <= 4;
}

/** Hidden-gem score in [0, 1]: high quality × low popularity. */
export function gemScore(p: Pick<Place, 'score' | 'popularity'>): number {
  return Math.max(0, (p.score - 6) / 4) * Math.max(0, (10 - p.popularity) / 9);
}

export interface Scored { value: number; why: string }

/** How much this place is worth to this traveller. */
export function placeValue(p: Place, req: PlanRequest): Scored {
  let v = p.score;
  const reasons: string[] = [];
  const matched = req.interests.filter((i) => INTEREST_CATEGORIES[i].includes(p.category));
  if (req.interests.length) {
    if (matched.length) { v *= 1.45; reasons.push(`matches your love of ${matched.map((m) => INTEREST_LABEL[m].toLowerCase()).join(' & ')}`); }
    else v *= 0.72;
  }
  const cw = COMPANION_WEIGHT[req.companions][p.category] ?? 1;
  v *= cw;
  if (cw >= 1.15) reasons.push(`great for ${req.companions === 'solo' ? 'solo travellers' : req.companions === 'family' ? 'families' : req.companions}`);
  // discovery slider: 0 = classics, 1 = off-beat
  const d = Math.min(1, Math.max(0, req.discovery / 100));
  const fame = (p.popularity - 5.5) / 4.5; // -1 obscure … +1 famous
  v *= 1 + (0.5 - d) * fame * 0.7;
  if (isGem(p)) {
    v += d * 2.2;
    reasons.push('a hidden gem few travellers reach');
  } else if (p.popularity >= 9) reasons.push('one of the places this destination is known for');
  if (req.mustInclude.includes(p.id)) { v += 1000; reasons.unshift('you asked to keep this'); }
  // "Show me another plan": places from the plans already shown drop far down the list, but stay
  // available so a short trip with few options still gets a full day
  if (req.avoid.includes(p.id) && !req.mustInclude.includes(p.id)) v *= 0.12;
  if (p.score >= 9 && reasons.length === 0) reasons.push('among the very best here');
  return { value: Math.max(0.1, v), why: reasons[0] ?? 'well worth the time' };
}
