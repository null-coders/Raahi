// npm run seed — loads every destination and place from data/*.json into the database.
// Curated rows are refreshed; places added by the community are kept.
import 'dotenv/config';
import { createPrisma } from './db';
import { loadCuratedData } from './loadData';

const db = await createPrisma();
const data = loadCuratedData();

for (const d of data.destinations) {
  await db.destination.upsert({
    where: { id: d.id },
    create: { id: d.id, name: d.name, state: d.state, region: d.region, data: JSON.stringify(d) },
    update: { name: d.name, state: d.state, region: d.region, data: JSON.stringify(d) },
  });
}
let n = 0;
for (const p of data.places) {
  const row = { destinationId: p.destinationId, name: p.name, category: p.category, lat: p.lat, lng: p.lng, data: JSON.stringify(p), source: 'curated', verifiedAt: new Date() };
  await db.place.upsert({ where: { id: p.id }, create: { id: p.id, ...row }, update: row });
  n++;
}
// remove curated places that were deleted from the data files
const ids = new Set(data.places.map((p) => p.id));
const stale = (await db.place.findMany({ where: { source: 'curated' }, select: { id: true } })).filter((p) => !ids.has(p.id));
if (stale.length) await db.place.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });

console.log(`✓ Seeded ${data.destinations.length} destinations and ${n} places${stale.length ? ` (removed ${stale.length} old)` : ''}`);
await db.$disconnect();
