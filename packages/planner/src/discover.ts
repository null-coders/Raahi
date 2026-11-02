// Discovery helpers: trending (z-score + min-heap top-K), in-season, hidden gems,
// nearby places (BFS on a k-nearest graph) and search (trie).

import { bfsWithinHops, Graph, haversineKm } from './graph';
import { topK } from './heap';
import { gemScore, isGem, MONTHS } from './model';
import { Trie } from './trie';
import type { Dataset, Destination, Place } from './types';

export interface TrendItem {
  destinationId: string;
  score: number;
  reason: string;
  kind: 'rising' | 'festival' | 'season';
}

/**
 * Trend score per destination.
 * - weekly: plan counts per week, oldest first (Raahi's own first-party signal, may be empty)
 * - rising = z-score of this week vs the previous 8 weeks, with older weeks decayed
 * - festivals in the coming month and the best-season match add curated signal for cold start
 */
export function trending(data: Dataset, today: string, weekly: Record<string, number[]> = {}, k = 10): TrendItem[] {
  const month = Number(today.slice(5, 7));
  const next = (month % 12) + 1;
  const items: TrendItem[] = data.destinations.map((d) => {
    const counts = weekly[d.id] ?? [];
    let z = 0;
    // needs real volume this week before anything counts as "rising"
    if (counts.length >= 3 && counts[counts.length - 1] >= 5) {
      const cur = counts[counts.length - 1];
      const hist = counts.slice(-9, -1);
      const weights = hist.map((_, i) => Math.pow(0.85, hist.length - 1 - i));
      const wsum = weights.reduce((a, b) => a + b, 0);
      const mean = hist.reduce((s, c, i) => s + c * weights[i], 0) / wsum;
      const sd = Math.sqrt(hist.reduce((s, c, i) => s + weights[i] * (c - mean) ** 2, 0) / wsum) || 1;
      z = (cur - mean) / sd;
    }
    const fest = d.festivals.find((f) => f.month === month || f.month === next);
    const inSeason = d.bestMonths.includes(month);
    const startsSoon = !inSeason && d.bestMonths.includes(next);
    let score = z * 2 + (fest ? 3 : 0) + (inSeason ? 2 : 0) + (startsSoon ? 1.2 : 0) + d.popularity * 0.15;
    if (!inSeason && !startsSoon && !fest) score -= 3;
    const kind: TrendItem['kind'] = z > 1.5 ? 'rising' : fest ? 'festival' : 'season';
    const reason = z > 1.5
      ? 'Plans rising fast this week'
      : fest ? `${fest.name} · ${MONTHS[fest.month - 1]}`
      : inSeason ? `Best time to go is now`
      : startsSoon ? `Season opens in ${MONTHS[next - 1]}`
      : 'Popular year-round';
    return { destinationId: d.id, score, reason, kind };
  });
  return topK(items, k, (i) => i.score);
}

export function inSeason(data: Dataset, month: number): Destination[] {
  return data.destinations.filter((d) => d.bestMonths.includes(month)).sort((a, b) => b.popularity - a.popularity);
}

export function hiddenGems(data: Dataset, k = 12): Place[] {
  return topK(data.places.filter(isGem), k, gemScore);
}

/** Places near `placeId`: BFS (2 hops) over each place's 3 nearest neighbours in the same destination. */
export function nearbyPlaces(data: Dataset, placeId: string, max = 4): { place: Place; km: number; hops: number }[] {
  const p = data.places.find((x) => x.id === placeId);
  if (!p) return [];
  const group = data.places.filter((x) => x.destinationId === p.destinationId);
  const g = new Graph(group.length);
  group.forEach((a, i) => {
    group
      .map((b, j) => ({ j, d: haversineKm(a.lat, a.lng, b.lat, b.lng) }))
      .filter((x) => x.j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, 3)
      .forEach(({ j, d }) => g.addEdge(i, j, d));
  });
  const start = group.findIndex((x) => x.id === placeId);
  return bfsWithinHops(g, start, 2)
    .map(({ node, hops }) => ({ place: group[node], hops, km: haversineKm(p.lat, p.lng, group[node].lat, group[node].lng) }))
    .sort((a, b) => a.hops - b.hops || a.km - b.km)
    .slice(0, max);
}

export interface SearchHit { kind: 'destination' | 'place'; id: string; title: string; subtitle: string }

export function buildSearch(data: Dataset) {
  const trie = new Trie();
  const lookup = new Map<string, SearchHit>();
  for (const d of data.destinations) {
    trie.insert(`${d.name} ${d.state}`, d.id);
    lookup.set(d.id, { kind: 'destination', id: d.id, title: d.name, subtitle: d.state });
  }
  const destName = new Map(data.destinations.map((d) => [d.id, d.name]));
  for (const p of data.places) {
    trie.insert(p.name, p.id);
    lookup.set(p.id, { kind: 'place', id: p.id, title: p.name, subtitle: destName.get(p.destinationId) ?? '' });
  }
  return (q: string, limit = 8): SearchHit[] => {
    const words = q.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    // every word must match (intersection of prefix sets)
    let ids = new Set(trie.search(words[0]));
    for (const w of words.slice(1)) {
      const next = new Set(trie.search(w));
      ids = new Set([...ids].filter((x) => next.has(x)));
    }
    const pop = (id: string) => {
      const d = data.destinations.find((x) => x.id === id);
      if (d) return 100 + d.popularity;
      return data.places.find((x) => x.id === id)?.popularity ?? 0;
    };
    return [...ids].sort((a, b) => pop(b) - pop(a)).slice(0, limit).map((id) => lookup.get(id)!);
  };
}
