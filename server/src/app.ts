// The API is deliberately thin: validate, load data, call the planner, return JSON.
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { createCatalog, newPlaceSchema, parsePlanRequest, planTrip, slug, type Catalog, type Place } from '@raahi/planner';
import { findPhotos, mediaKey, type MediaQuery } from '@raahi/media';
import type { Repo } from './repo';

export interface AppState { catalog: Catalog; weekly: Record<string, number[]>; refreshedAt: number }

export function createApp(repo: Repo, state: AppState) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '200kb' }));

  const today = () => new Date().toISOString().slice(0, 10);
  const wrap = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) =>
    (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, storage: repo.kind, destinations: state.catalog.data.destinations.length, places: state.catalog.data.places.length });
  });

  app.get('/api/destinations', (_req, res) => res.json(state.catalog.summaries()));

  app.get('/api/destinations/:id', (req, res) => {
    const d = state.catalog.destination(req.params.id);
    if (!d) return res.status(404).json({ error: 'not_found', message: 'We could not find that destination.' });
    res.json(d);
  });

  app.get('/api/places/:id', (req, res) => {
    const p = state.catalog.place(req.params.id);
    if (!p) return res.status(404).json({ error: 'not_found', message: 'We could not find that place.' });
    res.json(p);
  });

  app.get('/api/search', (req, res) => res.json(state.catalog.search(String(req.query.q ?? ''), 8)));

  app.get('/api/discover', (_req, res) => res.json(state.catalog.discover(today(), state.weekly)));

  app.post('/api/plan', wrap(async (req, res) => {
    const request = parsePlanRequest(req.body);
    const plan = planTrip(request, state.catalog.data);
    // the "no feasible plan" case is a normal answer, not a server error
    res.json(plan);
    if (plan.feasible) repo.logPlan(request.destinations, request.days, request.companions).catch(() => {});
  }));

  app.post('/api/places', wrap(async (req, res) => {
    const input = newPlaceSchema.parse(req.body);
    const dest = state.catalog.data.destinations.find((d) => d.id === input.destinationId);
    if (!dest) return res.status(400).json({ error: 'bad_destination', message: 'Pick one of the destinations.' });
    const place: Place = {
      ...input,
      id: `${dest.id}--${slug(input.name)}-${Date.now().toString(36)}`,
      source: 'community',
      tip: input.tip || undefined,
      wiki: input.wiki || undefined,
    };
    await repo.addPlace(place);
    state.catalog = createCatalog(await repo.loadDataset());
    res.status(201).json(place);
  }));

  app.post('/api/reports', wrap(async (req, res) => {
    const { placeId, kind, note } = req.body ?? {};
    if (typeof placeId !== 'string' || typeof kind !== 'string') return res.status(400).json({ error: 'bad_request' });
    await repo.addReport({ placeId, kind: kind.slice(0, 40), note: String(note ?? '').slice(0, 500) });
    res.status(201).json({ ok: true });
  }));

  // Photos: cached for 30 days so we stay well inside free API limits.
  const keys = { pexels: process.env.PEXELS_API_KEY || undefined, unsplash: process.env.UNSPLASH_ACCESS_KEY || undefined };
  const inflight = new Map<string, Promise<unknown>>();
  app.get('/api/media', wrap(async (req, res) => {
    const q: MediaQuery = {
      title: req.query.title ? String(req.query.title) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      count: Math.min(12, Number(req.query.count ?? 1) || 1),
      gallery: req.query.gallery === '1',
    };
    if (!q.title && !q.q) return res.status(400).json({ error: 'bad_request' });
    const key = mediaKey(q) + (keys.pexels || keys.unsplash ? ':k' : '');
    const cached = await repo.cacheGet(key, 30);
    if (cached) return res.type('json').send(cached);
    if (!inflight.has(key)) {
      inflight.set(key, findPhotos(q, keys).then(async (photos) => {
        if (photos.length) await repo.cacheSet(key, JSON.stringify(photos));
        return photos;
      }).finally(() => inflight.delete(key)));
    }
    res.set('Cache-Control', 'public, max-age=86400').json(await inflight.get(key));
  }));

  // Serve the built web app in production.
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  // errors → friendly JSON
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'invalid', message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    }
    if (err instanceof Error && err.message === 'Unknown destination') {
      return res.status(400).json({ error: 'bad_destination', message: 'We could not find that destination.' });
    }
    console.error(err);
    res.status(500).json({ error: 'server', message: 'Something went wrong on our side. Please try again.' });
  });

  return app;
}
