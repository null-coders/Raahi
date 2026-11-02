// Hand-checked photos for every destination and place, baked into data/media/photos.json.
// Loaded lazily (one small chunk) and used before any live photo lookup, so pages show real
// photos instantly and never depend on a search guessing right.
import { curatedPhoto, type CuratedPhoto, type Photo } from '@raahi/media';

export interface CuratedFile {
  dest: Record<string, CuratedPhoto[]>; // gallery, best first
  life: Record<string, (CuratedPhoto | null)[]>; // [people, festival or homes, food]
  place: Record<string, CuratedPhoto[]>; // [] = a curated place with no photo of its own
}

const EMPTY: CuratedFile = { dest: {}, life: {}, place: {} };
let file: Promise<CuratedFile> | null = null;

export function curatedFile(): Promise<CuratedFile> {
  file ??= import('../../../data/media/photos.json')
    .then((m) => (m.default ?? m) as unknown as CuratedFile)
    .catch(() => EMPTY);
  return file;
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Photos for a key: "dest:<id>", "life:<id>:<0-2>" or "place:<id>".
 * A curated place or "Life here" slot without a photo of its own borrows one from its destination's
 * gallery (a real photo of the same area) instead of a live search that could guess wrong.
 * Empty only for things Raahi doesn't know yet, such as places added from the app.
 */
export async function curatedPhotos(id: string): Promise<Photo[]> {
  const c = await curatedFile();
  const [kind, key, slot] = id.split(':');
  if (kind === 'dest') return (c.dest[key] ?? []).map(curatedPhoto);
  if (kind === 'life') {
    const own = c.life[key]?.[Number(slot)];
    if (own) return [curatedPhoto(own)];
    const g = c.dest[key] ?? [];
    return g.length ? [curatedPhoto(g[(3 + Number(slot)) % g.length])] : [];
  }
  if (kind === 'place') {
    const own = c.place[key];
    if (own?.length) return own.map(curatedPhoto);
    if (!own) return []; // not a curated place: let the live lookup try
    const g = c.dest[key.split('--')[0]] ?? [];
    return g.length ? [curatedPhoto(g[hash(key) % g.length])] : [];
  }
  return [];
}
