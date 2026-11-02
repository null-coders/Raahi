// npm run photos — optional. Every curated destination and place already ships with hand-checked photos
// (data/media/photos.json). This looks up and caches photos for anything without them, such as places
// added from the app, so those pages open instantly too. Safe to re-run; cached lookups are skipped.
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findPhotos, mediaKey, type MediaQuery } from '@raahi/media';
import { DATA_DIR } from './loadData';
import { openRepo } from './repo';

const repo = await openRepo();
const data = await repo.loadDataset();
const keys = { pexels: process.env.PEXELS_API_KEY || undefined, unsplash: process.env.UNSPLASH_ACCESS_KEY || undefined };
const suffix = keys.pexels || keys.unsplash ? ':k' : '';
const destName = new Map(data.destinations.map((d) => [d.id, d.name]));
const curatedPath = join(DATA_DIR, 'media', 'photos.json');
const curated = existsSync(curatedPath) ? JSON.parse(readFileSync(curatedPath, 'utf8')) : { dest: {}, place: {} };

// the same lookups the app makes when a page has no curated photos
const queries: MediaQuery[] = [];
for (const d of data.destinations) {
  if (curated.dest[d.id]?.length) continue;
  for (const count of [1, 8]) queries.push({ title: d.wiki, q: d.photoQuery ?? `${d.name} ${d.state}`, count, gallery: count > 1 });
}
for (const p of data.places) {
  if (curated.place[p.id]?.length) continue;
  for (const count of [1, 4]) queries.push({ title: p.wiki, q: p.photoQuery ?? `${p.name} ${destName.get(p.destinationId)}`.trim(), count });
}
if (!queries.length) console.log('✓ Every destination and place already has curated photos. Nothing to do.');

let done = 0, found = 0;
for (const q of queries) {
  const key = mediaKey(q) + suffix;
  if (!(await repo.cacheGet(key, 30))) {
    const photos = await findPhotos(q, keys);
    if (photos.length) { await repo.cacheSet(key, JSON.stringify(photos)); found++; }
    await new Promise((r) => setTimeout(r, 120)); // be polite to free APIs
  } else found++;
  if (++done % 25 === 0) console.log(`  ${done}/${queries.length}`);
}
if (queries.length) console.log(`✓ Photos ready for ${found} of ${queries.length} lookups`);
