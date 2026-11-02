// Real photos for places, from free sources, with credit. Works in Node 20+ and the browser.
//  0. Curated photos baked into data/media/photos.json (checked by hand, load instantly, no lookups)
//  1. Pexels / Unsplash: travel photography (needs a free API key, server only)
//  2. Wikipedia article images + Wikimedia Commons search (no key)
// Every photo keeps its author and licence so it can be credited on screen.
//
// Wikimedia only serves thumbnails at a few standard widths (330, 500, 960, 1280, 1920…); any other
// width fails to load. So every Wikimedia URL here is built from the file's real width and snapped
// to one of those sizes, never to an arbitrary number.

export interface Photo {
  url: string; // large, for heroes and galleries (≤1920px)
  thumb: string; // ≤960px, for cards
  credit: string; // "Photo: Jane Doe / Wikimedia Commons (CC BY-SA 4.0)"
  link: string; // page to credit / open
  source: 'pexels' | 'unsplash' | 'wikipedia' | 'commons';
  width?: number;
  height?: number;
}

export interface MediaKeys { pexels?: string; unsplash?: string }
export interface MediaQuery {
  /** Curated-photo key: "dest:<id>", "life:<id>:<0-2>" or "place:<id>". Checked before any lookup. */
  id?: string;
  title?: string; // Wikipedia article
  q?: string; // free-text search
  count?: number;
  gallery?: boolean;
}

/** A Wikimedia Commons file: name, hash folder ("f/fc"), size, author, licence. */
export interface CommonsFile { file: string; hash: string; w: number; h: number; artist?: string; license?: string }
/** Compact form stored in photos.json: [file, hash, width, height, artist, licence]. */
export type CuratedPhoto = [string, string, number, number, string, string];

export const WIKIMEDIA_WIDTHS = [330, 500, 960, 1280, 1920] as const;
const UPLOAD = 'https://upload.wikimedia.org/wikipedia/commons';

/** URL for a Commons file at most `want` px wide, using only widths Wikimedia actually serves. */
export function commonsUrl(f: Pick<CommonsFile, 'file' | 'hash' | 'w'>, want: number): string {
  const name = encodeURIComponent(f.file);
  const size = [...WIKIMEDIA_WIDTHS].reverse().find((s) => s <= want && s < f.w);
  return size ? `${UPLOAD}/thumb/${f.hash}/${name}/${size}px-${name}` : `${UPLOAD}/${f.hash}/${name}`;
}

export function commonsPhoto(f: CommonsFile): Photo {
  const lic = f.license ? ` (${f.license})` : '';
  return {
    url: commonsUrl(f, 1920),
    thumb: commonsUrl(f, 960),
    credit: `Photo: ${f.artist || 'Unknown'} / Wikimedia Commons${lic}`,
    link: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.file)}`,
    source: 'commons',
    width: f.w,
    height: f.h,
  };
}

export function curatedPhoto([file, hash, w, h, artist, license]: CuratedPhoto): Photo {
  return commonsPhoto({ file, hash, w, h, artist, license });
}

/** Older code kept full Wikimedia URLs; snap any width in one to a size Wikimedia serves. */
export function resizeWikimedia(url: string, width: number): string {
  const size = [...WIKIMEDIA_WIDTHS].reverse().find((s) => s <= width) ?? 330;
  return url.replace(/\/(\d+)px-([^/?]+)(\?.*)?$/, `/${size}px-$2`);
}

// ---------------------------------------------------------------- live lookups

const UA = { 'Api-User-Agent': 'Raahi/1.0 (trip planner)' };
// Words that mark maps, logos, documents, old drawings, official events and adult-only sculpture.
const BAD = new Set(('map maps locator location flag flags logo emblem seal icon diagram chart coat signature svg graph census poster ' +
  'stamp banknote coin painting drawing sketch engraving illustration lithograph watercolor watercolour manuscript plan book ' +
  'newspaper letter document pdf satellite minister meeting conference inauguration rally election addressing seminar press ' +
  'launch chairman governor secretary felicitation cm pm mla mp delegation award erotic erotica zoophilia sex sexual nude naked ' +
  'maithuna mithuna coitus orgy homosexuality').split(' '));

/** True for file names that are probably not a travel photo (maps, logos, old drawings, official events…). */
export function isBadFile(name: string): boolean {
  const toks = name.toLowerCase().replace(/\.[a-z]+$/, '').split(/[\s_\-.,()'’&+]+/);
  return toks.some((t) => BAD.has(t) || (/^\d{4}$/.test(t) && +t >= 1700 && +t < 1950));
}

async function getJson(url: string, headers: Record<string, string> = {}, ms = 8000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const stripHtml = (s = '') => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const norm = (f: string) => decodeURIComponent(f).replace(/ /g, '_');
const okName = (f?: string | null): f is string => !!f && /\.jpe?g$/i.test(f) && !isBadFile(f);

/** Commons file name from an upload.wikimedia.org URL (original or thumbnail). */
function fileFromUrl(u: string): string | null {
  try {
    const p = new URL(u).pathname.split('/');
    const i = p.indexOf('commons');
    if (i < 1 || p[i - 1] !== 'wikipedia') return null;
    return norm(p[i + 1] === 'thumb' ? p[i + 4] : p[i + 3]);
  } catch {
    return null;
  }
}

async function pexels(q: string, n: number, key: string): Promise<Photo[]> {
  const j = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}&orientation=landscape`, { Authorization: key });
  return (j.photos ?? []).map((p: any) => ({
    url: p.src.large2x, thumb: p.src.large, credit: `Photo: ${p.photographer} / Pexels`, link: p.url, source: 'pexels',
    width: p.width, height: p.height,
  }));
}

async function unsplash(q: string, n: number, key: string): Promise<Photo[]> {
  const j = await getJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${n}&orientation=landscape&client_id=${key}`);
  return (j.results ?? []).map((p: any) => ({
    url: `${p.urls.raw}&w=1800&q=80&auto=format`, thumb: p.urls.small, credit: `Photo: ${p.user.name} / Unsplash`,
    link: `${p.links.html}?utm_source=raahi&utm_medium=referral`, source: 'unsplash', width: p.width, height: p.height,
  }));
}

async function wikiLeadFile(title: string): Promise<string[]> {
  const j = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, UA);
  const f = j.originalimage?.source ? fileFromUrl(j.originalimage.source) : null;
  return okName(f) ? [f] : [];
}

async function wikiGalleryFiles(title: string, n: number): Promise<string[]> {
  const j = await getJson(`https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`, UA);
  return (j.items ?? []).filter((it: any) => it.type === 'image').map((it: any) => norm(String(it.title ?? '').replace(/^File:/, ''))).filter(okName).slice(0, n * 2);
}

async function commonsSearchFiles(q: string, n: number): Promise<string[]> {
  const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srnamespace=6&srlimit=${n * 3}` +
    `&srsearch=${encodeURIComponent(`${q} filetype:bitmap`)}`, UA);
  return (j.query?.search ?? []).map((x: any) => norm(String(x.title).replace(/^File:/, ''))).filter(okName);
}

/** Size, author and licence for up to 50 Commons files; files that aren't on Commons are dropped. */
export async function commonsInfo(files: string[]): Promise<CommonsFile[]> {
  if (!files.length) return [];
  const titles = files.slice(0, 50).map((f) => `File:${f}`).join('|');
  const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo` +
    `&iiprop=url|size|mime|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&titles=${encodeURIComponent(titles)}`, UA);
  const byName = new Map<string, CommonsFile>();
  for (const p of Object.values(j.query?.pages ?? {}) as any[]) {
    const ii = p.imageinfo?.[0];
    const m = ii?.url?.match(/\/wikipedia\/commons\/([0-9a-f]\/[0-9a-f]{2})\//);
    if (!ii || !m || ii.mime !== 'image/jpeg') continue;
    const file = norm(String(p.title).replace(/^File:/, ''));
    byName.set(file, {
      file, hash: m[1], w: ii.width, h: ii.height,
      artist: stripHtml(ii.extmetadata?.Artist?.value).slice(0, 60) || 'Unknown',
      license: stripHtml(ii.extmetadata?.LicenseShortName?.value),
    });
  }
  return files.map((f) => byName.get(f)).filter((x): x is CommonsFile => !!x);
}

/**
 * Find photos. `title` = Wikipedia article, `q` = free-text search. Tries the prettiest source first and
 * falls back down the list; never throws (returns [] when nothing works, e.g. offline).
 * Curated photos (query.id) are resolved by the caller before this is reached.
 */
export async function findPhotos(query: MediaQuery, keys: MediaKeys = {}): Promise<Photo[]> {
  const n = Math.max(1, Math.min(query.count ?? 1, 12));
  const text = query.q ?? query.title?.replace(/_/g, ' ').replace(/\(.*?\)/g, '').trim() ?? '';
  const out: Photo[] = [];
  const add = (ps: Photo[]) => { for (const p of ps) if (out.length < n && !out.some((o) => o.url === p.url)) out.push(p); };
  try {
    if (keys.pexels && text) add(await pexels(text, n, keys.pexels));
    if (out.length < n && keys.unsplash && text) add(await unsplash(text, n, keys.unsplash));
  } catch { /* fall through to Wikimedia */ }
  if (out.length >= n) return out;

  const names: string[] = [];
  const collect = async (f: () => Promise<string[]>) => { try { for (const x of await f()) if (!names.includes(x)) names.push(x); } catch { /* next source */ } };
  if (query.title) await collect(() => wikiLeadFile(query.title!));
  if (query.title && (query.gallery || n > 1)) await collect(() => wikiGalleryFiles(query.title!, n));
  if (names.length < n * 2 && text) await collect(() => commonsSearchFiles(text, n));
  try {
    const files = await commonsInfo(names.slice(0, 50));
    // big enough to look sharp, and landscape-ish so it crops well into cards
    add(files.filter((f) => f.w >= 800 && f.w >= f.h * 0.9).map(commonsPhoto));
  } catch { /* offline */ }
  return out;
}

export function mediaKey(q: MediaQuery): string {
  return JSON.stringify(['v2', q.id ?? '', q.title ?? '', q.q ?? '', q.count ?? 1, q.gallery ? 1 : 0]); // v2: standard Wikimedia widths
}
