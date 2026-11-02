// Storage. Prisma + SQLite is the default; a JSON-file store is used when the database
// isn't set up yet (or setup failed), so `npm run dev` always works.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dataset, Destination, Place } from '@raahi/planner';
import { createPrisma } from './db';
import { loadCuratedData } from './loadData';

export interface Repo {
  kind: 'prisma' | 'json';
  loadDataset(): Promise<Dataset>;
  addPlace(p: Place): Promise<void>;
  logPlan(destinationIds: string[], days: number, companions: string): Promise<void>;
  /** Plan counts per destination per week, oldest first, covering the last `weeks` weeks. */
  weeklyCounts(weeks: number): Promise<Record<string, number[]>>;
  addReport(r: { placeId: string; kind: string; note: string }): Promise<void>;
  cacheGet(key: string, maxAgeDays: number): Promise<string | null>;
  cacheSet(key: string, json: string): Promise<void>;
}

const WEEK = 7 * 24 * 3600 * 1000;
function bucketWeeks(rows: { destinationId: string; createdAt: Date }[], weeks: number) {
  const out: Record<string, number[]> = {};
  const now = Date.now();
  for (const r of rows) {
    const age = Math.floor((now - r.createdAt.getTime()) / WEEK);
    if (age >= weeks) continue;
    (out[r.destinationId] ??= new Array(weeks).fill(0))[weeks - 1 - age]++;
  }
  return out;
}

// ------------------------------------------------------------------ Prisma

export async function prismaRepo(): Promise<Repo> {
  const db = await createPrisma();
  await db.destination.count(); // fails fast if the database or its tables aren't set up yet
  return {
    kind: 'prisma',
    async loadDataset() {
      const [dests, places] = await Promise.all([
        db.destination.findMany(),
        db.place.findMany({ where: { status: 'live' } }),
      ]);
      return {
        destinations: dests.map((d) => JSON.parse(d.data) as Destination),
        places: places.map((p) => JSON.parse(p.data) as Place),
      };
    },
    async addPlace(p) {
      await db.place.create({
        data: { id: p.id, destinationId: p.destinationId, name: p.name, category: p.category, lat: p.lat, lng: p.lng, data: JSON.stringify(p), source: 'community' },
      });
    },
    async logPlan(ids, days, companions) {
      await db.planLog.createMany({ data: ids.map((destinationId) => ({ destinationId, days, companions })) });
    },
    async weeklyCounts(weeks) {
      const since = new Date(Date.now() - weeks * WEEK);
      const rows = await db.planLog.findMany({ where: { createdAt: { gte: since } }, select: { destinationId: true, createdAt: true } });
      return bucketWeeks(rows, weeks);
    },
    async addReport(r) { await db.report.create({ data: r }); },
    async cacheGet(key, maxAgeDays) {
      const row = await db.mediaCache.findUnique({ where: { key } });
      if (!row || Date.now() - row.updatedAt.getTime() > maxAgeDays * 86400_000) return null;
      return row.json;
    },
    async cacheSet(key, json) {
      await db.mediaCache.upsert({ where: { key }, create: { key, json }, update: { json } });
    },
  };
}

// ------------------------------------------------------------------ JSON files

export function jsonRepo(dir = join(dirname(fileURLToPath(import.meta.url)), '..', '.data')): Repo {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = (n: string) => join(dir, `${n}.json`);
  const read = <T>(n: string, fallback: T): T => {
    try { return JSON.parse(readFileSync(file(n), 'utf8')) as T; } catch { return fallback; }
  };
  const write = (n: string, v: unknown) => writeFileSync(file(n), JSON.stringify(v));
  return {
    kind: 'json',
    async loadDataset() {
      const base = loadCuratedData();
      const extra = read<Place[]>('community-places', []);
      return { destinations: base.destinations, places: [...base.places, ...extra] };
    },
    async addPlace(p) { write('community-places', [...read<Place[]>('community-places', []), p]); },
    async logPlan(ids, days, companions) {
      const log = read<{ destinationId: string; at: number; days: number; companions: string }[]>('plan-log', []);
      for (const destinationId of ids) log.push({ destinationId, at: Date.now(), days, companions });
      write('plan-log', log.slice(-20000));
    },
    async weeklyCounts(weeks) {
      const log = read<{ destinationId: string; at: number }[]>('plan-log', []);
      return bucketWeeks(log.map((l) => ({ destinationId: l.destinationId, createdAt: new Date(l.at) })), weeks);
    },
    async addReport(r) { write('reports', [...read<unknown[]>('reports', []), { ...r, at: Date.now() }]); },
    async cacheGet(key, maxAgeDays) {
      const c = read<Record<string, { json: string; at: number }>>('media-cache', {});
      const hit = c[key];
      return hit && Date.now() - hit.at < maxAgeDays * 86400_000 ? hit.json : null;
    },
    async cacheSet(key, json) {
      const c = read<Record<string, { json: string; at: number }>>('media-cache', {});
      c[key] = { json, at: Date.now() };
      write('media-cache', c);
    },
  };
}

export async function openRepo(): Promise<Repo> {
  if (process.env.DATA_BACKEND === 'json') return jsonRepo();
  try {
    return await prismaRepo();
  } catch (e) {
    console.warn(`⚠ Database not ready (${(e as Error).message.split('\n')[0]}). Using JSON files instead — run "npm run setup" to create the database.`);
    return jsonRepo();
  }
}
