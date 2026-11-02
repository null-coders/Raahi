import { loadCuratedData } from '../src/loadData';
const data = loadCuratedData();
const name = new Map(data.destinations.map((d) => [d.id, d.name]));
const D = data.destinations.map((d) => [d.id, d.name, d.state, d.wiki ?? '', d.festivals[0]?.name ?? '', d.dishes[0] ?? '']);
const P = data.places.map((p) => [p.id, p.name, name.get(p.destinationId), p.wiki ?? '', p.category]);
process.stdout.write(JSON.stringify({ D, P }));
