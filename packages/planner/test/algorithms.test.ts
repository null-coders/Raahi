import { describe, expect, it } from 'vitest';
import {
  bfsWithinHops, connectedComponents, dfsReachable, dijkstra, floydWarshall, Graph, kruskal,
  knapsack2D, lcs, MinHeap, mstClusters, prim, resourceAllocation, topK, Trie, type KnapItem,
} from '../src';

// small deterministic random generator so failures are reproducible
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('MinHeap / topK', () => {
  it('pops in ascending order', () => {
    const h = new MinHeap<number>((a, b) => a - b);
    [5, 1, 9, 3, 7, 2].forEach((x) => h.push(x));
    const out: number[] = [];
    while (h.size) out.push(h.pop()!);
    expect(out).toEqual([1, 2, 3, 5, 7, 9]);
  });
  it('topK returns the k largest, best first', () => {
    expect(topK([4, 8, 1, 9, 3, 7], 3, (x) => x)).toEqual([9, 8, 7]);
  });
});

describe('graph traversal', () => {
  const g = new Graph(6);
  g.addEdge(0, 1, 1); g.addEdge(1, 2, 1); g.addEdge(3, 4, 1); // 5 isolated
  it('DFS finds the reachable set', () => {
    expect(dfsReachable(g, 0)).toEqual([true, true, true, false, false, false]);
  });
  it('counts connected components', () => {
    expect(connectedComponents(g).count).toBe(3);
  });
  it('BFS respects the hop limit', () => {
    expect(bfsWithinHops(g, 0, 1).map((x) => x.node)).toEqual([1]);
    expect(bfsWithinHops(g, 0, 2).map((x) => x.node)).toEqual([1, 2]);
  });
});

describe('shortest paths', () => {
  it('Dijkstra matches Floyd–Warshall on random graphs', () => {
    const r = rng(7);
    for (let trial = 0; trial < 25; trial++) {
      const n = 8;
      const g = new Graph(n);
      for (let i = 0; i < 16; i++) g.addEdge(Math.floor(r() * n), Math.floor(r() * n), Math.round(r() * 50) + 1);
      const fw = floydWarshall(g);
      for (let s = 0; s < n; s++) expect(dijkstra(g, s).dist).toEqual(fw.dist[s]);
    }
  });
  it('finds the classic detour', () => {
    const g = new Graph(3);
    g.addEdge(0, 2, 10); g.addEdge(0, 1, 3); g.addEdge(1, 2, 4);
    expect(dijkstra(g, 0).dist[2]).toBe(7);
  });
});

describe('minimum spanning tree', () => {
  it('Kruskal and Prim agree on total weight', () => {
    const r = rng(11);
    for (let trial = 0; trial < 20; trial++) {
      const n = 7;
      const dist = Array.from({ length: n }, () => new Array<number>(n).fill(0));
      const edges = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const w = Math.round(r() * 100) + 1;
        dist[i][j] = dist[j][i] = w;
        edges.push({ u: i, v: j, w });
      }
      const k = kruskal(n, edges).reduce((s, e) => s + e.w, 0);
      const p = prim(dist).reduce((s, e) => s + e.w, 0);
      expect(k).toBe(p);
    }
  });
  it('MST clustering separates far-apart groups', () => {
    // two tight groups: {0,1,2} and {3,4}
    const pts = [[0, 0], [0, 1], [1, 0], [50, 50], [51, 50]];
    const dist = pts.map((a) => pts.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])));
    const groups = mstClusters(dist, [0, 1, 2, 3, 4], 2).map((g) => g.sort()).sort((a, b) => a.length - b.length);
    expect(groups).toEqual([[3, 4], [0, 1, 2]]);
  });
});

describe('0/1 knapsack with two capacities', () => {
  const brute = (items: KnapItem[], C: number, T: number) => {
    let best = 0;
    for (let mask = 0; mask < 1 << items.length; mask++) {
      let c = 0, t = 0, v = 0;
      items.forEach((it, i) => { if (mask & (1 << i)) { c += it.cost; t += it.time; v += it.value; } });
      if (c <= C && t <= T) best = Math.max(best, v);
    }
    return best;
  };
  it('matches brute force on 200 random instances', () => {
    const r = rng(3);
    for (let trial = 0; trial < 200; trial++) {
      const items = Array.from({ length: 2 + Math.floor(r() * 9) }, () => ({
        value: Math.floor(r() * 50) + 1, cost: Math.floor(r() * 20), time: Math.floor(r() * 15),
      }));
      const C = Math.floor(r() * 60), T = Math.floor(r() * 40);
      const res = knapsack2D(items, C, T);
      expect(res.value).toBe(brute(items, C, T));
      // the traced set must be valid and add up
      const c = res.chosen.reduce((s, i) => s + items[i].cost, 0);
      const t = res.chosen.reduce((s, i) => s + items[i].time, 0);
      const v = res.chosen.reduce((s, i) => s + items[i].value, 0);
      expect(c).toBeLessThanOrEqual(C);
      expect(t).toBeLessThanOrEqual(T);
      expect(v).toBe(res.value);
    }
  });
  it('finds the best pair where taking the best-looking items one by one would not', () => {
    const items = [
      { value: 60, cost: 10, time: 1 },
      { value: 100, cost: 20, time: 1 },
      { value: 120, cost: 30, time: 1 },
    ];
    expect(knapsack2D(items, 50, 10).value).toBe(220);
  });
});

describe('LCS', () => {
  it('textbook example', () => {
    expect(lcs('ABCBDAB'.split(''), 'BDCABA'.split('')).length).toBe(4);
    expect(lcs('STONE'.split(''), 'LONGEST'.split('')).sequence.join('')).toHaveLength(3);
  });
});

describe('resource allocation', () => {
  it('matches brute force', () => {
    const gain = [
      [-Infinity, 4, 7, 9, 10],
      [-Infinity, 5, 6, 6.5, 7],
      [-Infinity, 3, 8, 9, 9],
    ];
    const total = 6;
    let best = -Infinity;
    for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) {
      const c = total - a - b;
      if (c >= 1 && c <= 4) best = Math.max(best, gain[0][a] + gain[1][b] + gain[2][c]);
    }
    const r = resourceAllocation(gain, total);
    expect(r.value).toBe(best);
    expect(r.alloc.reduce((s, x) => s + x, 0)).toBe(total);
  });
});

describe('Trie', () => {
  it('finds by any word prefix', () => {
    const t = new Trie();
    t.insert('Spiti Valley', 'spiti');
    t.insert('Valley of Flowers', 'vof');
    expect(t.search('val').sort()).toEqual(['spiti', 'vof']);
    expect(t.search('spi')).toEqual(['spiti']);
    expect(t.search('xyz')).toEqual([]);
  });
});
