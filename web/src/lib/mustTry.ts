// "Must try" — the street food, signature dishes, drinks and experiences that make a place feel like itself.
// Texts live in data/musttry/*.json (one file per region), photos in data/media/musttry-photos.json.
// Both load lazily, so they never slow down the first page.
import { curatedPhoto, type CuratedPhoto, type Photo } from '@raahi/media';

/** [name, kind, where, approx price in rupees (0 = free), description, photo key] */
type Raw = [string, string, string, number, string, string];

export interface MustTry {
  id: string;
  destId: string;
  name: string;
  kind: string;
  where: string;
  price: number;
  desc: string;
  key: string;
  photo?: Photo;
  isExperience: boolean;
}

const texts = import.meta.glob('../../../data/musttry/*.json');
let textsP: Promise<Record<string, Raw[]>> | null = null;
let photosP: Promise<Record<string, CuratedPhoto[]>> | null = null;

const loadTexts = () =>
  (textsP ??= Promise.all(Object.values(texts).map((load) => load().then((m) => ((m as { default?: unknown }).default ?? m) as Record<string, Raw[]>)))
    .then((parts) => Object.assign({}, ...parts) as Record<string, Raw[]>)
    .catch((): Record<string, Raw[]> => ({})));

const loadPhotos = () =>
  (photosP ??= import('../../../data/media/musttry-photos.json')
    .then((m) => ((m as { default?: unknown }).default ?? m) as unknown as Record<string, CuratedPhoto[]>)
    .catch((): Record<string, CuratedPhoto[]> => ({})));

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function mustTryFor(destId: string): Promise<MustTry[]> {
  const [all, photos] = await Promise.all([loadTexts(), loadPhotos()]);
  return (all[destId] ?? []).map(([name, kind, where, price, desc, key]) => {
    const list = photos[key] ?? [];
    // several places share a dish (momos, kachori…): each takes a different photo of it
    const pick = list.length ? list[hash(destId + name) % list.length] : undefined;
    return {
      id: `${destId}:${slug(name)}`, destId, name, kind, where, price, desc, key,
      photo: pick ? curatedPhoto(pick) : undefined,
      isExperience: kind === 'Experience',
    };
  });
}

/** A hand-picked handful for the home page: [destination id, item name]. */
export const FEATURED: [string, string][] = [
  ['varanasi', 'Dawn boat ride on the Ganga'],
  ['delhi', 'Chhole bhature'],
  ['hyderabad', 'Hyderabadi dum biryani'],
  ['mumbai', 'Vada pav'],
  ['amritsar', 'Amritsari kulcha with chhole'],
  ['kolkata', 'Rosogolla and mishti doi'],
  ['jaipur', 'Dal baati churma'],
  ['alleppey', 'Overnight houseboat cruise'],
  ['lucknow', 'Galouti kabab'],
  ['srinagar', 'Kahwa'],
  ['darjeeling', 'First-flush Darjeeling tea'],
  ['madurai', 'Jigarthanda'],
];

export async function featuredMustTry(): Promise<(MustTry & { destName?: string })[]> {
  const ids = [...new Set(FEATURED.map(([d]) => d))];
  const lists = await Promise.all(ids.map((d) => mustTryFor(d)));
  const byDest = new Map(ids.map((d, i) => [d, lists[i]]));
  return FEATURED.flatMap(([d, n]) => {
    const it = byDest.get(d)?.find((x) => x.name === n);
    return it ? [it] : [];
  });
}
