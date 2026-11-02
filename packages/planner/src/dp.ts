// Unit 3 (Dynamic Programming): 0/1 knapsack with two capacities,
// longest common subsequence and the resource allocation (multistage) problem.

export interface KnapItem {
  /** Integer value to maximise. */
  value: number;
  /** Integer weight in the first capacity (money units). */
  cost: number;
  /** Integer weight in the second capacity (time units). */
  time: number;
}

export interface KnapResult { chosen: number[]; value: number; cells: number }

/**
 * 0/1 knapsack with two capacities (budget and time).
 *   dp[i][c][t] = best value using the first i items with at most c money units and t time units
 *   dp[i][c][t] = max(dp[i-1][c][t], dp[i-1][c - cost_i][t - time_i] + value_i)
 * We keep one rolling 2-D layer (iterating c and t downwards so each item is used once) and a
 * keep[i][c][t] bit per cell to trace the chosen items back, exactly like reading c[n, w] backwards
 * in the 1-D textbook version.
 */
export function knapsack2D(items: KnapItem[], capCost: number, capTime: number): KnapResult {
  const C = Math.max(0, Math.floor(capCost));
  const T = Math.max(0, Math.floor(capTime));
  const W = (C + 1) * (T + 1);
  const n = items.length;
  const dp = new Float64Array(W);
  const keep = new Uint8Array(n * W);
  for (let i = 0; i < n; i++) {
    const { value, cost, time } = items[i];
    if (cost > C || time > T || value <= 0) continue;
    const base = i * W;
    for (let c = C; c >= cost; c--) {
      const row = c * (T + 1);
      const rowFrom = (c - cost) * (T + 1);
      for (let t = T; t >= time; t--) {
        const cand = dp[rowFrom + t - time] + value;
        if (cand > dp[row + t]) {
          dp[row + t] = cand;
          keep[base + row + t] = 1;
        }
      }
    }
  }
  // backtrack from the full-capacity cell
  const chosen: number[] = [];
  let c = C, t = T;
  for (let i = n - 1; i >= 0; i--) {
    if (keep[i * W + c * (T + 1) + t]) {
      chosen.push(i);
      c -= items[i].cost;
      t -= items[i].time;
    }
  }
  chosen.reverse();
  return { chosen, value: dp[W - 1], cells: n * W };
}

/**
 * Longest common subsequence of two sequences.
 *   L[i][j] = L[i-1][j-1] + 1            if a[i] = b[j]
 *           = max(L[i-1][j], L[i][j-1])   otherwise
 */
export function lcs<T>(a: T[], b: T[]): { length: number; sequence: T[] } {
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      L[i][j] = a[i - 1] === b[j - 1] ? L[i - 1][j - 1] + 1 : Math.max(L[i - 1][j], L[i][j - 1]);
  const sequence: T[] = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { sequence.unshift(a[i - 1]); i--; j--; }
    else if (L[i - 1][j] >= L[i][j - 1]) i--;
    else j--;
  }
  return { length: L[n][m], sequence };
}

/** Similarity of two ordered plans in [0, 1], based on LCS length. */
export function planSimilarity<T>(a: T[], b: T[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  return (2 * lcs(a, b).length) / (a.length + b.length);
}

/**
 * Resource allocation (multistage graph) DP.
 * gain[i][u] = value of giving u units (days) to stage i (city i); -Infinity means not allowed.
 *   best[i][r] = max over u of gain[i][u] + best[i+1][r-u]
 * Returns how many units each stage gets and the total value.
 */
export function resourceAllocation(gain: number[][], total: number): { alloc: number[]; value: number } {
  const n = gain.length;
  const best = Array.from({ length: n + 1 }, () => new Array<number>(total + 1).fill(-Infinity));
  const pick = Array.from({ length: n }, () => new Array<number>(total + 1).fill(-1));
  best[n][0] = 0; // all units must be used
  for (let i = n - 1; i >= 0; i--) {
    for (let r = 0; r <= total; r++) {
      for (let u = 0; u <= r && u < gain[i].length; u++) {
        const g = gain[i][u];
        const rest = best[i + 1][r - u];
        if (g === -Infinity || rest === -Infinity) continue;
        if (g + rest > best[i][r]) { best[i][r] = g + rest; pick[i][r] = u; }
      }
    }
  }
  const alloc: number[] = [];
  let r = total;
  for (let i = 0; i < n; i++) {
    const u = pick[i][r];
    alloc.push(Math.max(0, u));
    r -= Math.max(0, u);
  }
  return { alloc, value: best[0][total] };
}
