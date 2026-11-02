// A trip request lives in the URL, so every plan can be shared, bookmarked and reopened.
import type { PlanRequest, PlanResult } from '@raahi/planner';

export function defaultRequest(destinations: string[] = []): PlanRequest {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return {
    destinations, startDate: d.toISOString().slice(0, 10), days: 2, dayStart: '08:30', dayEnd: '19:00',
    startPoint: null, budget: 10000, budgetType: 'per_person', companions: 'couple', people: 2, kids: false, elders: false,
    interests: [], pace: 'balanced', discovery: 40, includeStay: true, mustInclude: [], exclude: [], avoid: [],
  };
}

const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeRequest(r: PlanRequest): string {
  // drop empty arrays and defaults to keep links short
  const slim: Record<string, unknown> = {};
  const def = defaultRequest() as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(r)) {
    if (Array.isArray(v) && !v.length && k !== 'destinations') continue;
    if (k !== 'destinations' && k !== 'startDate' && JSON.stringify(v) === JSON.stringify(def[k])) continue;
    slim[k] = v;
  }
  return toB64(JSON.stringify(slim));
}

export function decodeRequest(s: string | null): PlanRequest | null {
  if (!s) return null;
  try {
    return { ...defaultRequest(), ...JSON.parse(fromB64(s)) } as PlanRequest;
  } catch {
    return null;
  }
}

export const tripUrl = (r: PlanRequest) => `/trip?r=${encodeRequest(r)}`;

// ---------- saved trips (this device only) ----------
export interface SavedTrip { key: string; title: string; dates: string; destinationIds: string[]; request: PlanRequest; savedAt: number; total: number; places: number }
const KEY = 'raahi.saved.v1';
export function savedTrips(): SavedTrip[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
export function saveTrip(plan: PlanResult): SavedTrip {
  const key = encodeRequest(plan.request);
  const last = plan.days[plan.days.length - 1]?.date ?? plan.request.startDate;
  const trip: SavedTrip = {
    key, title: plan.title, dates: `${plan.request.startDate}|${last}`, destinationIds: plan.request.destinations,
    request: plan.request, savedAt: Date.now(), total: plan.totals.cost.total, places: plan.totals.places,
  };
  const all = [trip, ...savedTrips().filter((t) => t.key !== key)].slice(0, 50);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full or blocked */ }
  return trip;
}
export function removeTrip(key: string) {
  try { localStorage.setItem(KEY, JSON.stringify(savedTrips().filter((t) => t.key !== key))); } catch { /* ignore */ }
}
export const isSaved = (r: PlanRequest) => savedTrips().some((t) => t.key === encodeRequest(r));
