// Raahi's data files use a compact format so a destination and all its places fit in one readable
// block. This module expands it into full Destination / Place objects (and validates it).
//
// Destination keys:  id n st r ty ll bm days terr food stay tag ab ppl eat fest lang go w pq pop alt hub roads places
// Place keys:        id n c ll m f o x mo s p d t w pq a
//   a = flags: "k" avoid with small kids, "e" hard for elders, "n" best in the evening
//   x = weekdays closed (0 = Sun … 6 = Sat), mo = months open (1–12)
// Road: [from, to, km, minutes, months?] — from/to are local place ids or "hub"

import { CATEGORIES, DEST_TYPES, REGIONS, TERRAINS, type Category, type Dataset, type Destination, type Place, type Road } from './types';

export interface RawPlace {
  id?: string; n: string; c: string; ll: [number, number]; m: number; f?: number; o?: string;
  x?: number[]; mo?: number[]; s: number; p: number; d: string; t?: string; w?: string; pq?: string; a?: string;
}
export interface RawDestination {
  id: string; n: string; st: string; r: string; ty: string[]; ll: [number, number]; bm: number[];
  days: [number, number]; terr: string; food: number; stay: number; tag: string; ab: string; ppl: string;
  eat: string[]; fest?: [string, number][]; lang: string; go: string; w?: string; pq?: string; pop: number;
  alt?: number; hub?: [string, number, number]; roads?: (string | number | number[])[][]; places: RawPlace[];
}

export const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export class DataError extends Error {}

export function expandDataset(raws: RawDestination[]): Dataset {
  const destinations: Destination[] = [];
  const places: Place[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const r of raws) {
    const where = `destination "${r.id ?? r.n}"`;
    if (seen.has(r.id)) errors.push(`${where}: duplicate id`);
    seen.add(r.id);
    if (!REGIONS.includes(r.r as never)) errors.push(`${where}: unknown region ${r.r}`);
    if (!TERRAINS.includes(r.terr as never)) errors.push(`${where}: unknown terrain ${r.terr}`);
    for (const t of r.ty) if (!DEST_TYPES.includes(t as never)) errors.push(`${where}: unknown type ${t}`);
    if (!inIndia(r.ll)) errors.push(`${where}: coordinates ${r.ll} are outside India`);
    const localIds = new Set<string>();
    const ps: Place[] = r.places.map((rp) => {
      const local = rp.id ?? slug(rp.n);
      if (localIds.has(local)) errors.push(`${where}: duplicate place ${local}`);
      localIds.add(local);
      if (!CATEGORIES.includes(rp.c as never)) errors.push(`${where} / ${rp.n}: unknown category ${rp.c}`);
      if (!inIndia(rp.ll)) errors.push(`${where} / ${rp.n}: coordinates outside India`);
      const far = distKm(r.ll, rp.ll);
      if (far > 260) errors.push(`${where} / ${rp.n}: ${Math.round(far)} km from the destination centre — check coordinates`);
      if (rp.o && rp.o !== '24h' && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(rp.o)) errors.push(`${where} / ${rp.n}: bad hours "${rp.o}"`);
      return {
        id: `${r.id}--${local}`,
        destinationId: r.id,
        name: rp.n,
        category: rp.c as Category,
        lat: rp.ll[0], lng: rp.ll[1],
        visitMins: rp.m,
        fee: rp.f ?? 0,
        open: rp.o ?? '06:00-19:00',
        closedDays: rp.x ?? [],
        months: rp.mo ?? null,
        score: rp.s,
        popularity: rp.p,
        description: rp.d,
        tip: rp.t,
        wiki: rp.w,
        photoQuery: rp.pq,
        avoidKids: (rp.a ?? '').includes('k'),
        avoidElders: (rp.a ?? '').includes('e'),
        evening: (rp.a ?? '').includes('n'),
        source: 'curated',
      };
    });
    const roads: Road[] | undefined = r.roads?.map((row) => {
      const [from, to, km, mins, months] = row as [string, string, number, number, number[] | undefined];
      const fix = (x: string) => (x === 'hub' ? 'hub' : `${r.id}--${x}`);
      if (from !== 'hub' && !localIds.has(from)) errors.push(`${where}: road from unknown place ${from}`);
      if (to !== 'hub' && !localIds.has(to)) errors.push(`${where}: road to unknown place ${to}`);
      return { from: fix(from), to: fix(to), km, mins, months };
    });
    destinations.push({
      id: r.id, name: r.n, state: r.st, region: r.r as Destination['region'], types: r.ty as Destination['types'],
      lat: r.ll[0], lng: r.ll[1], bestMonths: r.bm, idealDays: r.days, terrain: r.terr as Destination['terrain'],
      foodPerDay: r.food, stayPerNight: r.stay, tagline: r.tag, about: r.ab, people: r.ppl, dishes: r.eat,
      festivals: (r.fest ?? []).map(([name, month]) => ({ name, month })), language: r.lang, gettingThere: r.go,
      wiki: r.w, photoQuery: r.pq, popularity: r.pop, altitude: r.alt,
      hub: r.hub ? { name: r.hub[0], lat: r.hub[1], lng: r.hub[2] } : { name: `${r.n} centre`, lat: r.ll[0], lng: r.ll[1] },
      roads,
    });
    places.push(...ps);
  }
  if (errors.length) throw new DataError(errors.join('\n'));
  return { destinations, places };
}

const inIndia = ([lat, lng]: [number, number]) => lat > 6 && lat < 37.5 && lng > 68 && lng < 97.6;
const distKm = (a: [number, number], b: [number, number]) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
