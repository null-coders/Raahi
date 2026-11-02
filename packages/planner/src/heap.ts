/** Binary min-heap. Used by Dijkstra (EXTRACT-MIN) and by the top-K trending list. */
export class MinHeap<T> {
  private data: T[] = [];
  constructor(private readonly cmp: (a: T, b: T) => number) {}

  get size(): number { return this.data.length; }
  peek(): T | undefined { return this.data[0]; }

  push(item: T): void {
    const d = this.data;
    d.push(item);
    let i = d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(d[i], d[p]) >= 0) break;
      [d[i], d[p]] = [d[p], d[i]];
      i = p;
    }
  }

  pop(): T | undefined {
    const d = this.data;
    if (d.length === 0) return undefined;
    const top = d[0];
    const last = d.pop()!;
    if (d.length) {
      d[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < d.length && this.cmp(d[l], d[m]) < 0) m = l;
        if (r < d.length && this.cmp(d[r], d[m]) < 0) m = r;
        if (m === i) break;
        [d[i], d[m]] = [d[m], d[i]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Top-K largest items in O(n log k): keep a min-heap of size k; the smallest of the
 * current best k sits on top and is evicted when something bigger arrives.
 */
export function topK<T>(items: Iterable<T>, k: number, score: (t: T) => number): T[] {
  const heap = new MinHeap<{ item: T; s: number }>((a, b) => a.s - b.s);
  for (const item of items) {
    const s = score(item);
    if (heap.size < k) heap.push({ item, s });
    else if (s > heap.peek()!.s) { heap.pop(); heap.push({ item, s }); }
  }
  const out: { item: T; s: number }[] = [];
  while (heap.size) out.push(heap.pop()!);
  return out.reverse().map((x) => x.item);
}
