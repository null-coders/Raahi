// One door to data. Talks to the Raahi API; if the API isn't reachable (or this is the static build),
// it answers from the curated data bundled with the app, using the same planner code.
import { createCatalog, parsePlanRequest, planTrip, type Catalog, type Dataset, type DestinationDetail, type DestinationSummary, type DiscoverFeed, type Place, type PlaceDetail, type PlanRequest, type PlanResult, type SearchHit } from '@raahi/planner';
import { findPhotos, mediaKey, type MediaQuery, type Photo } from '@raahi/media';
import { curatedPhotos } from './curated';

// VITE_API_URL points a static build (e.g. Netlify) at a Raahi server hosted elsewhere (Render, Railway…).
// Without it, the static build answers from the bundled data. Maps and weather never need the server.
const API_BASE = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const STATIC = import.meta.env.VITE_STATIC === 'true' && !API_BASE;
let offline: Promise<Catalog> | null = null;
let apiDown = STATIC;

function offlineCatalog(): Promise<Catalog> {
  offline ??= import('./offline').then((m) => createCatalog(m.dataset()));
  return offline;
}

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new TypeError('API not available');
  const body = await res.json();
  if (!res.ok) throw new ApiError(body.error ?? 'error', body.message ?? 'Something went wrong');
  return body as T;
}

/** Try the API; on a network-level failure fall back to the bundled data. */
async function withFallback<T>(api: () => Promise<T>, local: (c: Catalog) => T | null): Promise<T> {
  if (!apiDown) {
    try { return await api(); } catch (e) {
      if (e instanceof ApiError) throw e;
      apiDown = true;
    }
  }
  const r = local(await offlineCatalog());
  if (r === null) throw new ApiError('not_found', 'We could not find that.');
  return r;
}

export const isOffline = () => apiDown;
const today = () => new Date().toISOString().slice(0, 10);

export const api = {
  discover: () => withFallback(() => call<DiscoverFeed>('/discover'), (c) => c.discover(today())),
  destinations: () => withFallback(() => call<DestinationSummary[]>('/destinations'), (c) => c.summaries()),
  destination: (id: string) => withFallback(() => call<DestinationDetail>(`/destinations/${id}`), (c) => c.destination(id)),
  place: (id: string) => withFallback(() => call<PlaceDetail>(`/places/${id}`), (c) => c.place(id)),
  search: (q: string) => withFallback(() => call<SearchHit[]>(`/search?q=${encodeURIComponent(q)}`), (c) => c.search(q, 8)),

  /** First plan goes to the server (so it counts towards Trending); edits re-plan locally. */
  plan: (req: PlanRequest) => withFallback(
    () => call<PlanResult>('/plan', { method: 'POST', body: JSON.stringify(req) }),
    (c) => planTrip(parsePlanRequest(req), c.data),
  ),

  addPlace: (p: Record<string, unknown>) => {
    if (apiDown) return Promise.reject(new ApiError('offline', 'Adding places needs the Raahi server running (npm run dev).'));
    return call<Place>('/places', { method: 'POST', body: JSON.stringify(p) });
  },
  report: (placeId: string, kind: string, note: string) =>
    apiDown ? Promise.resolve() : call('/reports', { method: 'POST', body: JSON.stringify({ placeId, kind, note }) }),
};

// ---------- local re-planning (what-if sliders, swaps) ----------
const detailCache = new Map<string, Promise<DestinationDetail>>();
export function destinationDetail(id: string) {
  if (!detailCache.has(id)) detailCache.set(id, api.destination(id));
  return detailCache.get(id)!;
}
export async function planLocally(req: PlanRequest): Promise<PlanResult> {
  const details = await Promise.all(req.destinations.map(destinationDetail));
  const data: Dataset = {
    destinations: details.map((d) => d.destination),
    places: details.flatMap((d) => d.places.map(({ gem: _g, ...p }) => p as Place)),
  };
  return planTrip(parsePlanRequest(req), data);
}

// ---------- photos ----------
const photoCache = new Map<string, Promise<Photo[]>>();
export function photos(q: MediaQuery): Promise<Photo[]> {
  const key = mediaKey(q);
  if (!photoCache.has(key)) {
    const params = new URLSearchParams();
    if (q.title) params.set('title', q.title);
    if (q.q) params.set('q', q.q);
    params.set('count', String(q.count ?? 1));
    if (q.gallery) params.set('gallery', '1');
    const live = () => {
      const viaApi = apiDown ? Promise.reject(new Error('offline')) : fetch(`${API_BASE}/api/media?${params}`).then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : Promise.reject(r)));
      return viaApi.then((ps: Photo[]) => (ps.length ? ps : findPhotos(q))).catch(() => findPhotos(q));
    };
    // curated photos first (instant, checked by hand); live lookup only when a place has none
    const curated = q.id ? curatedPhotos(q.id).catch(() => [] as Photo[]) : Promise.resolve([] as Photo[]);
    photoCache.set(key, curated.then((ps) => (ps.length ? ps.slice(0, Math.max(q.count ?? 1, 1)) : live())));
  }
  return photoCache.get(key)!;
}

// ---------- weather (Open-Meteo, no key, called straight from the browser: live even without the server) ----------
export interface DayWeather { date: string; max: number; min: number; code: number; rain: number }
export interface CurrentWeather { temp: number; feels: number; code: number; humidity: number; wind: number; isDay: boolean; time: string }
export interface WeatherReport { current?: CurrentWeather; daily: DayWeather[]; fetchedAt: number }

/** Forecasts change slowly; reuse a fetch for 10 minutes so many cards on one page cost one request. */
export const WEATHER_TTL = 10 * 60 * 1000;
const wxCache = new Map<string, { at: number; p: Promise<Omit<WeatherReport, 'daily'> & { all: DayWeather[] }> }>();

function fetchForecast(lat: number, lng: number, fresh: boolean) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = wxCache.get(key);
  if (hit && !fresh && Date.now() - hit.at < WEATHER_TTL) return hit.p;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=16';
  const p = fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`weather ${r.status}`)))).then((j) => ({
    fetchedAt: Date.now(),
    current: j.current ? {
      temp: Math.round(j.current.temperature_2m), feels: Math.round(j.current.apparent_temperature ?? j.current.temperature_2m),
      code: j.current.weather_code, humidity: Math.round(j.current.relative_humidity_2m ?? 0), wind: Math.round(j.current.wind_speed_10m ?? 0),
      isDay: j.current.is_day !== 0, time: String(j.current.time ?? ''),
    } : undefined,
    all: (j.daily?.time ?? []).map((date: string, i: number) => ({
      date, max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]),
      code: j.daily.weather_code[i], rain: j.daily.precipitation_probability_max?.[i] ?? 0,
    })) as DayWeather[],
  }));
  p.catch(() => wxCache.delete(key)); // a failed fetch must not stick for 10 minutes
  wxCache.set(key, { at: Date.now(), p });
  return p;
}

/** Current conditions + daily forecast from `start` (default today) for `days` days. `fresh` skips the cache. */
export async function weather(lat: number, lng: number, start?: string, days = 7, fresh = false): Promise<WeatherReport> {
  const { all, current, fetchedAt } = await fetchForecast(lat, lng, fresh);
  const from = start ? all.findIndex((d) => d.date >= start) : 0;
  return { current, fetchedAt, daily: from >= 0 ? all.slice(from, from + days) : [] };
}
