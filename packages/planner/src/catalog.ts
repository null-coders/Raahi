// Read-side views shared by the API and the web app's offline mode, so both answer identically.
import { buildSearch, hiddenGems, nearbyPlaces, trending, type SearchHit, type TrendItem } from './discover';
import { gemScore, isGem } from './model';
import { REGIONS, type Dataset, type Destination, type Place, type Region } from './types';

export interface DestinationSummary {
  id: string; name: string; state: string; region: Region; types: string[]; tagline: string;
  lat: number; lng: number; bestMonths: number[]; idealDays: [number, number]; popularity: number;
  wiki?: string; photoQuery?: string; placeCount: number; gemCount: number; terrain: string;
  foodPerDay: number; stayPerNight: number;
}

export interface DiscoverFeed {
  month: number;
  trending: (TrendItem & { destination: DestinationSummary })[];
  inSeason: DestinationSummary[];
  gems: (Place & { destinationName: string; gem: number })[];
  regions: { region: Region; destinations: DestinationSummary[] }[];
  popular: DestinationSummary[];
}

export interface DestinationDetail { destination: Destination; places: (Place & { gem: boolean })[] }
export interface PlaceDetail {
  place: Place & { gem: boolean };
  destination: DestinationSummary;
  nearby: { place: Place; km: number }[];
}

export function createCatalog(data: Dataset) {
  const search = buildSearch(data);
  const byDest = new Map<string, Place[]>();
  for (const p of data.places) (byDest.get(p.destinationId) ?? byDest.set(p.destinationId, []).get(p.destinationId)!).push(p);
  const summary = (d: Destination): DestinationSummary => {
    const ps = byDest.get(d.id) ?? [];
    return {
      id: d.id, name: d.name, state: d.state, region: d.region, types: d.types, tagline: d.tagline,
      lat: d.lat, lng: d.lng, bestMonths: d.bestMonths, idealDays: d.idealDays, popularity: d.popularity,
      wiki: d.wiki, photoQuery: d.photoQuery, placeCount: ps.length, gemCount: ps.filter(isGem).length,
      terrain: d.terrain, foodPerDay: d.foodPerDay, stayPerNight: d.stayPerNight,
    };
  };
  const summaries = data.destinations.map(summary);
  const sById = new Map(summaries.map((s) => [s.id, s]));

  return {
    data,
    summaries: () => summaries,
    search: (q: string, limit?: number): SearchHit[] => search(q, limit),

    discover(today: string, weekly: Record<string, number[]> = {}): DiscoverFeed {
      const month = Number(today.slice(5, 7));
      const trend = trending(data, today, weekly, 10).map((t) => ({ ...t, destination: sById.get(t.destinationId)! }));
      const inSeason = summaries.filter((s) => s.bestMonths.includes(month)).sort((a, b) => b.popularity - a.popularity).slice(0, 14);
      const destName = new Map(data.destinations.map((d) => [d.id, d.name]));
      const gems = hiddenGems(data, 14).map((p) => ({ ...p, destinationName: destName.get(p.destinationId) ?? '', gem: gemScore(p) }));
      const regions = REGIONS.map((region) => ({
        region,
        destinations: summaries.filter((s) => s.region === region).sort((a, b) => b.popularity - a.popularity),
      })).filter((r) => r.destinations.length);
      const popular = [...summaries].sort((a, b) => b.popularity - a.popularity).slice(0, 12);
      return { month, trending: trend, inSeason, gems, regions, popular };
    },

    destination(id: string): DestinationDetail | null {
      const d = data.destinations.find((x) => x.id === id);
      if (!d) return null;
      const places = (byDest.get(id) ?? []).map((p) => ({ ...p, gem: isGem(p) })).sort((a, b) => b.score * 10 + b.popularity - (a.score * 10 + a.popularity));
      return { destination: d, places };
    },

    place(id: string): PlaceDetail | null {
      const p = data.places.find((x) => x.id === id);
      if (!p) return null;
      return {
        place: { ...p, gem: isGem(p) },
        destination: sById.get(p.destinationId)!,
        nearby: nearbyPlaces(data, id, 4).map(({ place, km }) => ({ place, km: Math.round(km * 10) / 10 })),
      };
    },
  };
}
export type Catalog = ReturnType<typeof createCatalog>;
