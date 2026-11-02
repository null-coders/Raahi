// Unit 2 (Graphs): adjacency list, DFS / connected components, BFS, Dijkstra,
// Floyd–Warshall, Kruskal and Prim. Every function is pure and works on plain arrays.

import { MinHeap } from './heap';

export interface Edge { u: number; v: number; w: number }

/** Undirected weighted graph stored as an adjacency list. */
export class Graph {
  readonly n: number;
  readonly adj: { to: number; w: number }[][];
  private edgeCount = 0;

  constructor(n: number) {
    this.n = n;
    this.adj = Array.from({ length: n }, () => []);
  }

  addEdge(u: number, v: number, w: number): void {
    if (u === v) return;
    // keep only the lighter edge if the pair already exists
    const existing = this.adj[u].find((e) => e.to === v);
    if (existing) {
      if (w < existing.w) {
        existing.w = w;
        this.adj[v].find((e) => e.to === u)!.w = w;
      }
      return;
    }
    this.adj[u].push({ to: v, w });
    this.adj[v].push({ to: u, w });
    this.edgeCount++;
  }

  get edges(): number { return this.edgeCount; }

  edgeList(): Edge[] {
    const out: Edge[] = [];
    for (let u = 0; u < this.n; u++) for (const e of this.adj[u]) if (u < e.to) out.push({ u, v: e.to, w: e.w });
    return out;
  }
}

/** Great-circle distance in km. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** DFS (iterative, explicit stack): every vertex reachable from `start`. */
export function dfsReachable(g: Graph, start: number): boolean[] {
  const seen = new Array<boolean>(g.n).fill(false);
  const stack = [start];
  seen[start] = true;
  while (stack.length) {
    const u = stack.pop()!;
    for (const { to } of g.adj[u]) {
      if (!seen[to]) { seen[to] = true; stack.push(to); }
    }
  }
  return seen;
}

/** Connected components with DFS. Returns a component id per vertex. */
export function connectedComponents(g: Graph): { count: number; comp: number[] } {
  const comp = new Array<number>(g.n).fill(-1);
  let count = 0;
  for (let s = 0; s < g.n; s++) {
    if (comp[s] !== -1) continue;
    const stack = [s];
    comp[s] = count;
    while (stack.length) {
      const u = stack.pop()!;
      for (const { to } of g.adj[u]) if (comp[to] === -1) { comp[to] = count; stack.push(to); }
    }
    count++;
  }
  return { count, comp };
}

/** BFS: vertices within `maxHops` edges of `start`, nearest levels first. */
export function bfsWithinHops(g: Graph, start: number, maxHops: number): { node: number; hops: number }[] {
  const dist = new Array<number>(g.n).fill(-1);
  const queue: number[] = [start];
  dist[start] = 0;
  const out: { node: number; hops: number }[] = [];
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    if (dist[u] >= maxHops) continue;
    for (const { to } of g.adj[u]) {
      if (dist[to] === -1) {
        dist[to] = dist[u] + 1;
        queue.push(to);
        out.push({ node: to, hops: dist[to] });
      }
    }
  }
  return out;
}

/** Dijkstra with a binary min-heap. O((V + E) log V). Weights must be non-negative. */
export function dijkstra(g: Graph, source: number): { dist: number[]; prev: number[] } {
  const dist = new Array<number>(g.n).fill(Infinity);
  const prev = new Array<number>(g.n).fill(-1);
  dist[source] = 0;
  const heap = new MinHeap<{ node: number; d: number }>((a, b) => a.d - b.d);
  heap.push({ node: source, d: 0 });
  while (heap.size) {
    const { node: u, d } = heap.pop()!;
    if (d > dist[u]) continue; // stale entry
    for (const { to, w } of g.adj[u]) {
      const nd = d + w;
      if (nd < dist[to]) { // RELAX(u, v, w)
        dist[to] = nd;
        prev[to] = u;
        heap.push({ node: to, d: nd });
      }
    }
  }
  return { dist, prev };
}

/** Rebuild the vertex path from Dijkstra's `prev` array. */
export function pathTo(prev: number[], target: number): number[] {
  const path: number[] = [];
  for (let v = target; v !== -1; v = prev[v]) path.unshift(v);
  return path;
}

/**
 * Floyd–Warshall all-pairs shortest paths. O(V³).
 * dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]) for every intermediate k.
 * `next` lets us rebuild the actual path between any pair.
 */
export function floydWarshall(g: Graph): { dist: number[][]; next: number[][] } {
  const n = g.n;
  const dist = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  const next = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? j : -1)));
  for (let u = 0; u < n; u++) {
    for (const { to, w } of g.adj[u]) {
      if (w < dist[u][to]) { dist[u][to] = w; next[u][to] = to; }
    }
  }
  for (let k = 0; k < n; k++) {
    const dk = dist[k];
    for (let i = 0; i < n; i++) {
      const di = dist[i];
      const dik = di[k];
      if (dik === Infinity) continue;
      for (let j = 0; j < n; j++) {
        const cand = dik + dk[j];
        if (cand < di[j]) { di[j] = cand; next[i][j] = next[i][k]; }
      }
    }
  }
  return { dist, next };
}

export function floydPath(next: number[][], u: number, v: number): number[] {
  if (next[u][v] === -1) return [];
  const path = [u];
  while (u !== v) { u = next[u][v]; path.push(u); }
  return path;
}

/** Disjoint-set union with path compression + union by rank (used by Kruskal). */
export class UnionFind {
  private parent: number[];
  private rank: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array<number>(n).fill(0);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): boolean {
    let ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    if (this.rank[ra] < this.rank[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    if (this.rank[ra] === this.rank[rb]) this.rank[ra]++;
    return true;
  }
}

/** Kruskal's MST: sort edges ascending, add an edge when it joins two different trees. */
export function kruskal(n: number, edges: Edge[]): Edge[] {
  const sorted = [...edges].sort((a, b) => a.w - b.w);
  const uf = new UnionFind(n);
  const tree: Edge[] = [];
  for (const e of sorted) {
    if (uf.union(e.u, e.v)) {
      tree.push(e);
      if (tree.length === n - 1) break;
    }
  }
  return tree;
}

/** Prim's MST on a dense distance matrix, O(V²). Gives the same total weight as Kruskal. */
export function prim(dist: number[][]): Edge[] {
  const n = dist.length;
  if (n === 0) return [];
  const inTree = new Array<boolean>(n).fill(false);
  const best = new Array<number>(n).fill(Infinity);
  const from = new Array<number>(n).fill(-1);
  best[0] = 0;
  const tree: Edge[] = [];
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let v = 0; v < n; v++) if (!inTree[v] && (u === -1 || best[v] < best[u])) u = v;
    if (best[u] === Infinity) break; // disconnected
    inTree[u] = true;
    if (from[u] !== -1) tree.push({ u: from[u], v: u, w: dist[from[u]][u] });
    for (let v = 0; v < n; v++) {
      if (!inTree[v] && dist[u][v] < best[v]) { best[v] = dist[u][v]; from[v] = u; }
    }
  }
  return tree;
}

/**
 * MST clustering: build the MST over `points` (indices into `dist`) and cut its k−1 heaviest edges.
 * What remains is k groups of places that sit close together — one group per trip day.
 */
export function mstClusters(dist: number[][], points: number[], k: number): number[][] {
  if (points.length === 0) return [];
  k = Math.max(1, Math.min(k, points.length));
  const local: Edge[] = [];
  for (let a = 0; a < points.length; a++)
    for (let b = a + 1; b < points.length; b++) {
      const w = dist[points[a]][points[b]];
      local.push({ u: a, v: b, w: Number.isFinite(w) ? w : 1e9 });
    }
  const tree = kruskal(points.length, local);
  const keep = [...tree].sort((a, b) => a.w - b.w).slice(0, Math.max(0, tree.length - (k - 1)));
  const uf = new UnionFind(points.length);
  for (const e of keep) uf.union(e.u, e.v);
  const groups = new Map<number, number[]>();
  points.forEach((p, i) => {
    const r = uf.find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(p);
  });
  return [...groups.values()];
}
