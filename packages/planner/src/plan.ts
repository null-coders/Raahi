// The Raahi pipeline: filter → graph → DFS → Dijkstra / Floyd–Warshall → knapsack (DP)
// → MST day split → route + schedule → explain. Multi-city trips add resource-allocation DP on top.

import { dfsReachable, dijkstra, floydWarshall, floydPath, Graph, haversineKm, kruskal, mstClusters } from './graph';
import { knapsack2D, resourceAllocation, type KnapItem } from './dp';
import {
  addDays, DAYS, driveMins, fmtDuration, fmtTime, MONTHS, monthOf, openWindow, PACE, placeValue,
  roadKm, toMin, transportMode, WALK_KM, walkMins, type TransportMode,
} from './model';
import type {
  Dataset, DayPlan, Destination, LeftOut, Place, PipelineStep, PlanRequest, PlanResult, TimelineItem,
} from './types';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const LUNCH_FROM = 12 * 60 + 30;
const LUNCH_LATEST = 14 * 60 + 30;

interface DestOpts {
  firstDayIndex: number;
  startDate: string;
  days: number;
  nights: number;
  budgetTotal: number;
  arrivalDelay: number; // minutes lost on day 1 (arrival from the previous city)
  arrivalFrom?: { name: string; km: number; mins: number; cost: number };
}

interface Ctx {
  dest: Destination;
  req: PlanRequest;
  cand: Place[]; // candidate places, node i+1 in the graph
  M: number[][]; // travel minutes between nodes (0 = start point)
  K: number[][]; // road km between nodes
  dur: number[]; // visit minutes per node (0 for hub)
  values: number[];
  whys: string[];
  mode: TransportMode;
  buffer: number;
  lunch: number;
  hub: { name: string; lat: number; lng: number };
  dayDates: string[];
  dayStarts: number[];
  dayEnd: number;
}

interface DestResult {
  feasible: boolean;
  infeasibleReason?: string;
  minBudget?: number;
  days: DayPlan[];
  value: number;
  placeIds: string[];
  cost: { entry: number; transport: number; food: number; stay: number };
  km: number;
  travelMins: number;
  leftOut: LeftOut[];
  warnings: string[];
  pipeline: PipelineStep[];
  stats: { graphNodes: number; graphEdges: number; dpCells: number; floydMs: number; dijkstraMs: number; knapsackMs: number };
}

// ---------------------------------------------------------------------------------------------

export function planTrip(req: PlanRequest, data: Dataset): PlanResult {
  const t0 = now();
  const dests = req.destinations
    .map((id) => data.destinations.find((d) => d.id === id))
    .filter((d): d is Destination => Boolean(d));
  if (!dests.length) throw new Error('Unknown destination');
  const people = Math.max(1, req.people);
  const budgetTotal = req.budgetType === 'per_person' ? req.budget * people : req.budget;
  const placesOf = (d: Destination) => data.places.filter((p) => p.destinationId === d.id);

  if (dests.length === 1) {
    const r = planDestination(dests[0], placesOf(dests[0]), req, {
      firstDayIndex: 0, startDate: req.startDate, days: req.days,
      nights: req.includeStay ? req.days - 1 : 0, budgetTotal, arrivalDelay: 0,
    });
    return assemble(req, dests, [r], [req.days], 0, 0, budgetTotal, now() - t0);
  }

  // ---- multi-city: resource allocation DP decides how many days each city gets ----
  const n = dests.length;
  const D = req.days;
  const legs = dests.map((d, i) => (i === 0 ? { km: 0, mins: 0 } : intercity(dests[i - 1], d)));
  const window = toMin(req.dayEnd) - toMin(req.dayStart);
  const interMode = transportMode({ companions: req.companions, people }, 'plains');
  const cache = new Map<string, DestResult>();
  const run = (i: number, d: number, offset: number) => {
    const key = `${i}:${d}:${offset}`;
    if (!cache.has(key)) {
      const isLast = i === n - 1;
      cache.set(key, planDestination(dests[i], placesOf(dests[i]), req, {
        firstDayIndex: offset, startDate: addDays(req.startDate, offset), days: d,
        nights: req.includeStay ? (isLast ? d - 1 : d) : 0,
        budgetTotal: (budgetTotal * d) / D, arrivalDelay: Math.min(window, legs[i].mins),
        arrivalFrom: i === 0 ? undefined : { name: dests[i - 1].hub.name, km: legs[i].km, mins: legs[i].mins, cost: Math.round(legs[i].km * interMode.perKm * interMode.vehicles) },
      }));
    }
    return cache.get(key)!;
  };
  const gain = dests.map((_, i) => {
    const row: number[] = [-Infinity];
    for (let d = 1; d <= D - (n - 1); d++) {
      const r = run(i, d, 0);
      row.push(r.feasible ? r.value : 0.001 * d);
    }
    return row;
  });
  const { alloc } = resourceAllocation(gain, D);
  const results: DestResult[] = [];
  let offset = 0;
  dests.forEach((_, i) => { results.push(run(i, alloc[i], offset)); offset += alloc[i]; });
  const interKm = legs.reduce((s, l) => s + l.km, 0);
  const interCost = Math.round(interKm * interMode.perKm * interMode.vehicles);
  return assemble(req, dests, results, alloc, interKm, interCost, budgetTotal, now() - t0, gain);
}

function intercity(a: Destination, b: Destination) {
  const km = haversineKm(a.hub.lat, a.hub.lng, b.hub.lat, b.hub.lng) * 1.35;
  const hilly = [a.terrain, b.terrain].some((t) => t === 'hills' || t === 'mountains');
  return { km, mins: (km / (hilly ? 30 : 45)) * 60 };
}

// ---------------------------------------------------------------------------------------------

function planDestination(dest: Destination, all: Place[], req: PlanRequest, o: DestOpts): DestResult {
  const people = Math.max(1, req.people);
  const pace = PACE[req.pace];
  const dayStart = toMin(req.dayStart);
  const dayEnd = toMin(req.dayEnd);
  const window = dayEnd - dayStart;
  const dayDates = Array.from({ length: o.days }, (_, i) => addDays(o.startDate, i));
  const dayStarts = dayDates.map((_, i) => dayStart + (i === 0 ? o.arrivalDelay : 0));
  const months = new Set(dayDates.map(monthOf));
  const weekdays = new Set(dayDates.map((d) => new Date(`${d}T00:00:00Z`).getUTCDay()));
  const hub = req.startPoint && req.destinations.length === 1 ? req.startPoint : dest.hub;
  const leftOut: LeftOut[] = [];
  const pipeline: PipelineStep[] = [];
  const warnings: string[] = [];
  const mode = transportMode({ companions: req.companions, people }, dest.terrain);

  // ---- fixed costs ----
  const lunchInWindow = dayStart <= LUNCH_FROM && dayEnd >= 14 * 60;
  const dayFraction = Math.min(1, window / 600);
  const food = Math.round(dest.foodPerDay * people * dayFraction * o.days);
  const rooms = req.companions === 'family' && req.kids ? Math.ceil(people / 3) : Math.ceil(people / 2);
  const stay = Math.round(dest.stayPerNight * rooms * Math.max(0, o.nights));
  const fixed = food + stay;

  pipeline.push({ step: `All places in ${dest.name}`, count: all.length, note: 'curated places worth visiting' });

  const timed: { p: Place; when: 'early' | 'late' }[] = [];

  // ---- 1. filter by dates, season, group and interests ----
  const monthNames = [...months].map((m) => MONTHS[m - 1]).join(', ');
  let cand = all.filter((p) => {
    if (req.exclude.includes(p.id)) { leftOut.push({ placeId: p.id, reason: 'excluded', detail: 'You removed this from the plan' }); return false; }
    if (p.months && ![...months].some((m) => p.months!.includes(m))) {
      leftOut.push({ placeId: p.id, reason: 'closed_season', detail: `Not accessible in ${monthNames} (open ${p.months.map((m) => MONTHS[m - 1]).join(', ')})` });
      return false;
    }
    if (p.closedDays.length && [...weekdays].every((w) => p.closedDays.includes(w))) {
      leftOut.push({ placeId: p.id, reason: 'closed_day', detail: `Closed on ${p.closedDays.map((d) => DAYS[d]).join(', ')} — your trip falls only on those days` });
      return false;
    }
    return true;
  });
  pipeline.push({ step: 'Open on your dates', count: cand.length, note: `season and weekly closures for ${monthNames}`, algorithm: 'Filter' });

  cand = cand.filter((p) => {
    if (req.kids && p.avoidKids) { leftOut.push({ placeId: p.id, reason: 'not_suitable', detail: 'Not suitable with small children' }); return false; }
    if (req.elders && p.avoidElders) { leftOut.push({ placeId: p.id, reason: 'not_suitable', detail: 'Steep climb or long walk — hard for elders' }); return false; }
    const ow = openWindow(p.open);
    const overlap = Math.min(ow.to, dayEnd) - Math.max(ow.from, dayStart);
    if (overlap < Math.min(p.visitMins, 45)) {
      // sunrise rides and evening shows sit outside the day: try them later as an early start or an evening out
      if (isEarly(ow, dayStart)) { timed.push({ p, when: 'early' }); return false; }
      if (isLate(ow, dayEnd) && ow.from <= dayEnd + 4 * 60) { timed.push({ p, when: 'late' }); return false; }
      leftOut.push({ placeId: p.id, reason: 'timing', detail: `Open ${p.open === '24h' ? 'all day' : p.open.replace('-', '–')}, outside your ${fmtTime(dayStart)}–${fmtTime(dayEnd)} day` });
      return false;
    }
    return true;
  });
  pipeline.push({ step: 'Right for your group', count: cand.length, note: `${req.companions}${req.kids ? ' with kids' : ''}${req.elders ? ' with elders' : ''}, open in your hours`, algorithm: 'Filter' });

  // ---- 2. build the graph (node 0 = start point) ----
  const nodes = [{ lat: hub.lat, lng: hub.lng }, ...cand.map((p) => ({ lat: p.lat, lng: p.lng }))];
  const idIndex = new Map<string, number>([['hub', 0], ...cand.map((p, i) => [p.id, i + 1] as [string, number])]);
  const N = nodes.length;
  const edgeKm = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const legMins = (km: number) => (km < WALK_KM ? walkMins(km) : driveMins(km, dest.terrain));

  const buildGraph = (respectMonths: boolean) => {
    const g = new Graph(N);
    if (dest.roads?.length) {
      for (const r of dest.roads) {
        const a = idIndex.get(r.from), b = idIndex.get(r.to);
        if (a === undefined || b === undefined) continue;
        if (respectMonths && r.months && ![...months].some((m) => r.months!.includes(m))) continue;
        g.addEdge(a, b, r.mins);
        edgeKm.set(key(a, b), r.km);
      }
    } else {
      // k-nearest-neighbour roads + the MST of straight-line distances (guarantees one component)
      const straight = nodes.map((a) => nodes.map((b) => haversineKm(a.lat, a.lng, b.lat, b.lng)));
      const all: { u: number; v: number; w: number }[] = [];
      for (let u = 0; u < N; u++) for (let v = u + 1; v < N; v++) all.push({ u, v, w: straight[u][v] });
      const addKm = (u: number, v: number) => {
        const km = roadKm(straight[u][v], dest.terrain);
        g.addEdge(u, v, legMins(km));
        edgeKm.set(key(u, v), km);
      };
      for (let u = 0; u < N; u++) {
        const near = straight[u].map((d, v) => ({ v, d })).filter((x) => x.v !== u).sort((a, b) => a.d - b.d).slice(0, 4);
        for (const { v } of near) addKm(u, v);
      }
      for (const e of kruskal(N, all)) addKm(e.u, e.v);
    }
    return g;
  };
  const graph = buildGraph(true);

  // ---- 3. DFS: what can we actually reach from the start point? ----
  const reach = dfsReachable(graph, 0);
  const reachAllYear = dest.roads?.length ? dfsReachable(buildGraph(false), 0) : reach;
  cand = cand.filter((p, i) => {
    if (reach[i + 1]) return true;
    leftOut.push({
      placeId: p.id,
      reason: reachAllYear[i + 1] ? 'road_closed' : 'too_far',
      detail: reachAllYear[i + 1] ? `The road there is closed in ${monthNames}` : `No road connects it to ${hub.name}`,
    });
    return false;
  });
  pipeline.push({ step: `Reachable from ${hub.name}`, count: cand.length, note: 'connected component of the road graph', algorithm: 'DFS' });

  // ---- 4. shortest paths: Dijkstra from the start, Floyd–Warshall between every pair ----
  let t = now();
  const dj = dijkstra(graph, 0);
  const dijkstraMs = now() - t;
  t = now();
  const fw = floydWarshall(graph);
  const floydMs = now() - t;
  const kmOfPath = (path: number[]) => {
    let s = 0;
    for (let i = 1; i < path.length; i++) s += edgeKm.get(key(path[i - 1], path[i])) ?? 0;
    return s;
  };
  // Re-index to the reachable candidates only
  const keepNodes = [0, ...cand.map((p) => idIndex.get(p.id)!)];
  const M = keepNodes.map((a) => keepNodes.map((b) => fw.dist[a][b]));
  const K = keepNodes.map((a) => keepNodes.map((b) => (a === b ? 0 : kmOfPath(floydPath(fw.next, a, b)))));

  // too far for a day trip from the base?
  const durOf = (p: Place) => Math.round(p.visitMins * pace.visit * (req.elders ? 1.15 : 1));
  const maxWindow = Math.max(...dayStarts.map((s) => dayEnd - s));
  const keepIdx: number[] = [0];
  cand = cand.filter((p, i) => {
    const round = dj.dist[idIndex.get(p.id)!] * 2 + durOf(p); // Dijkstra distance from the start point
    if (round <= maxWindow) { keepIdx.push(i + 1); return true; }
    leftOut.push({ placeId: p.id, reason: 'too_far', detail: `Round trip from ${hub.name} takes about ${fmtDuration(round)} — longer than your day. Worth an overnight stay nearby.` });
    return false;
  });
  const M2 = keepIdx.map((a) => keepIdx.map((b) => M[a][b]));
  const K2 = keepIdx.map((a) => keepIdx.map((b) => K[a][b]));
  pipeline.push({ step: 'Close enough for day trips', count: cand.length, note: `shortest travel times from ${hub.name}`, algorithm: 'Dijkstra + Floyd–Warshall' });

  const scored = cand.map((p) => placeValue(p, req));
  const ctx: Ctx = {
    dest, req, cand, M: M2, K: K2,
    dur: [0, ...cand.map(durOf)],
    values: [0, ...scored.map((s) => s.value)],
    whys: ['', ...scored.map((s) => s.why)],
    mode, buffer: pace.buffer, lunch: lunchInWindow ? pace.lunch : 0, hub, dayDates, dayStarts, dayEnd,
  };

  // ---- 5. knapsack items: value, money and time weights ----
  const n = cand.length;
  const access = (i: number) => {
    const ds = M2[i].map((d, j) => ({ d, j })).filter((x) => x.j !== i).sort((a, b) => a.d - b.d);
    const a = ds[0], b = ds[1] ?? ds[0];
    return { mins: (a.d + b.d) / 2, km: (K2[i][a.j] + K2[i][b.j]) / 2 };
  };
  const timeCap = dayStarts.reduce((s, st) => s + (dayEnd - st) - ctx.lunch - 25, 0);
  const moneyCap = o.budgetTotal - fixed;

  const itemCost = (i: number) => cand[i - 1].fee * people + access(i).km * mode.perKm * mode.vehicles;
  const itemTime = (i: number) => ctx.dur[i] + access(i).mins + ctx.buffer;

  if (moneyCap <= 0) {
    const cheapest = n ? Math.min(...cand.map((_, i) => itemCost(i + 1))) : 0;
    const need = Math.ceil((fixed + cheapest) / 500) * 500;
    return emptyResult(dest, o, {
      reason: `₹${o.budgetTotal.toLocaleString('en-IN')} doesn't cover food${stay ? ' and stay' : ''} for ${people} ${people > 1 ? 'people' : 'person'} in ${dest.name} (about ₹${fixed.toLocaleString('en-IN')}).`,
      minBudget: need, leftOut, pipeline, food, stay,
    });
  }

  const tUnit = 10;
  let cUnit = Math.max(10, Math.ceil(moneyCap / 350));
  const Tb = Math.max(0, Math.floor(timeCap / tUnit));
  while (n * (Math.floor(moneyCap / cUnit) + 1) * (Tb + 1) > 20_000_000) cUnit *= 2;
  const items: KnapItem[] = cand.map((_, k) => ({
    value: Math.round(ctx.values[k + 1] * 100),
    cost: Math.ceil(itemCost(k + 1) / cUnit),
    time: Math.ceil(itemTime(k + 1) / tUnit),
  }));
  const Cb = Math.floor(moneyCap / cUnit);

  // ---- 6. select → schedule → reselect ----
  // The DP picks the best set on estimated times; real opening hours and routes can still push a
  // stop out. Those stops are banned and the selection runs again, so freed time goes to others.
  interface Run {
    sched: ReturnType<typeof scheduleAll>; costs: { entry: number; transport: number }; value: number;
    dropped: Map<number, string>; overBudget: number[]; ms: number; cells: number; firstCount: number;
  }
  const valueOf = (idx: number[]) => idx.reduce((s, i) => s + ctx.values[i], 0);
  const order = Array.from({ length: n }, (_, k) => k + 1).sort((a, b) => ctx.values[b] - ctx.values[a]);
  const runStrategy = (solve: (its: KnapItem[]) => { chosen: number[]; cells: number }): Run => {
    const banned = new Map<number, string>();
    let best: Run | null = null;
    let ms = 0, cells = 0, firstCount = -1;
    for (let round = 0; round < 4; round++) {
      const its = items.map((it, k) => (banned.has(k + 1) ? { ...it, value: 0 } : it));
      const t1 = now();
      const sol = solve(its);
      ms += now() - t1;
      cells += sol.cells;
      if (firstCount < 0) firstCount = sol.chosen.length;
      let chosen = sol.chosen.map((k) => k + 1);
      let sched = scheduleAll(ctx, chosen, o.days);
      let costs = costOf(ctx, sched.days, people);
      const overBudget: number[] = [];
      while (costs.entry + costs.transport > moneyCap && sched.placed.length) {
        const worst = [...sched.placed].sort((a, b) => ctx.values[a] / (itemCost(a) + 1) - ctx.values[b] / (itemCost(b) + 1))[0];
        overBudget.push(worst);
        chosen = chosen.filter((c) => c !== worst);
        sched = scheduleAll(ctx, chosen, o.days);
        costs = costOf(ctx, sched.days, people);
      }
      // fill leftover gaps: try every unused place, best value first, wherever it fits
      for (let i = 1; i <= n; i++) {
        const p = order[i - 1];
        if (sched.placed.includes(p) || banned.has(p) || overBudget.includes(p)) continue;
        let bestIns: { d: number; order: number[]; day: SimDay } | null = null;
        for (let d = 0; d < o.days; d++) {
          const ins = cheapestInsertion(ctx, d, sched.days[d].order, p);
          if (ins && (!bestIns || ins.day.travel - sched.days[d].travel < bestIns.day.travel - sched.days[bestIns.d].travel)) bestIns = { d, ...ins };
        }
        if (!bestIns) continue;
        const trial = sched.days.map((x, d) => (d === bestIns!.d ? bestIns!.day : x));
        const tc = costOf(ctx, trial, people);
        if (tc.entry + tc.transport > moneyCap) continue;
        sched = { ...sched, days: trial, placed: trial.flatMap((x) => x.order), dropped: sched.dropped.filter(([q]) => q !== p) };
        costs = tc;
      }
      const dropped = new Map(banned);
      for (const [p, r] of sched.dropped) dropped.set(p, r);
      const run: Run = { sched, costs, value: valueOf(sched.placed), dropped, overBudget, ms, cells, firstCount };
      if (!best || run.value > best.value + 1e-9) best = run;
      const fresh = sched.dropped.filter(([p]) => !banned.has(p));
      if (!fresh.length) break;
      for (const [p, r] of fresh) banned.set(p, r);
    }
    best!.ms = ms;
    best!.cells = cells;
    return best!;
  };
  const kRun = runStrategy((its) => knapsack2D(its, Cb, Tb));
  const main = kRun;
  const sched = main.sched, costs = main.costs;
  pipeline.push({ step: 'Best set within budget and time', count: kRun.firstCount, note: `${kRun.cells.toLocaleString('en-IN')} table cells compared`, algorithm: '0/1 Knapsack (DP)' });
  if (o.days > 1) pipeline.push({ step: `Grouped into ${o.days} days`, count: sched.placed.length, note: 'nearby places share a day', algorithm: 'Kruskal MST clustering' });
  pipeline.push({ step: 'Fits real opening hours', count: sched.placed.length, note: 'ordered to cut travel, checked against hours, reselected if needed', algorithm: 'Nearest neighbour + 2-opt' });

  // ---- 7. explain everything we left out ----
  const placedSet = new Set(sched.placed);
  const usedMoney = costs.entry + costs.transport;
  const usedTime = sched.days.reduce((s, d) => s + d.busy, 0);
  for (const [idx, raw] of main.dropped) {
    if (placedSet.has(idx)) continue;
    const p = cand[idx - 1];
    const ow = openWindow(p.open);
    const reason = raw === 'timing' && ow.to - ow.from >= 8 * 60 ? 'no_time' : raw;
    leftOut.push({ placeId: p.id, reason: reason === 'closed_day' ? 'closed_day' : reason === 'timing' ? 'timing' : 'no_time', detail: dropDetail(reason, p) });
  }
  for (const idx of main.overBudget) {
    const p = cand[idx - 1];
    leftOut.push({ placeId: p.id, reason: 'over_budget', detail: `Would add about ₹${Math.round(itemCost(idx)).toLocaleString('en-IN')} — beyond your budget` });
  }
  const explained = new Set(leftOut.map((l) => l.placeId));
  for (let i = 1; i <= n; i++) {
    const p = cand[i - 1];
    if (placedSet.has(i) || explained.has(p.id)) continue;
    const c = itemCost(i), tm = itemTime(i);
    if (c > moneyCap - usedMoney) leftOut.push({ placeId: p.id, reason: 'over_budget', detail: `About ₹${Math.round(c).toLocaleString('en-IN')} more than your budget allows` });
    else if (tm > timeCap - usedTime) leftOut.push({ placeId: p.id, reason: 'no_time', detail: `Needs about ${fmtDuration(tm)} — no time left in your days` });
    else leftOut.push({ placeId: p.id, reason: 'lower_value', detail: 'Other places scored higher for your interests and group' });
  }

  if (!sched.placed.length && !timed.length) {
    return emptyResult(dest, o, {
      reason: `Nothing in ${dest.name} fits a ${fmtTime(dayStart)}–${fmtTime(dayEnd)} day with this budget. Try a longer day or a bigger budget.`,
      minBudget: undefined, leftOut, pipeline, food, stay,
    });
  }

  // ---- warnings ----
  if (dest.altitude && dest.altitude >= 2800) warnings.push(`${dest.name} sits at about ${dest.altitude.toLocaleString('en-IN')} m. Keep day 1 easy, drink plenty of water and watch for headaches.`);
  if (![...months].some((m) => dest.bestMonths.includes(m))) warnings.push(`${monthNames} isn't the best time for ${dest.name}. Best months: ${dest.bestMonths.map((m) => MONTHS[m - 1]).join(', ')}.`);
  const total = fixed + costs.entry + costs.transport;
  if (total > o.budgetTotal * 0.92) warnings.push('This plan uses almost all of your budget — keep a little aside for surprises.');

  // ---- build day plans ----
  const days: DayPlan[] = sched.days.map((d, i) => {
    const items: TimelineItem[] = [...d.items];
    if (i === 0 && o.arrivalFrom) {
      const mins = Math.min(o.arrivalFrom.mins, window);
      items.unshift({ type: 'travel', from: o.arrivalFrom.name, to: hub.name, start: dayStart, end: dayStart + mins, km: Math.round(o.arrivalFrom.km), mins: Math.round(o.arrivalFrom.mins), cost: o.arrivalFrom.cost, mode: 'Road transfer' });
    }
    return {
      index: o.firstDayIndex + i,
      date: dayDates[i],
      destinationId: dest.id,
      base: hub,
      items,
      placeIds: d.order.map((k) => cand[k - 1].id),
      km: Math.round(d.km),
      travelMins: Math.round(d.travel),
      note: d.order.length ? undefined : (i === 0 && o.arrivalDelay >= window ? `Travel day to ${dest.name}` : 'Free day — wander, rest or revisit a favourite'),
    };
  });

  // ---- 8. early starts and evenings out: sunrise rides, aartis and shows outside the normal day ----
  // Also places the day couldn't fit only because they run past its end (an evening aarti) or
  // start before it: they get a second chance as an evening out or an early start.
  for (let i = leftOut.length - 1; i >= 0; i--) {
    const l = leftOut[i];
    if (l.reason !== 'timing' && l.reason !== 'no_time') continue;
    const p = cand.find((c) => c.id === l.placeId);
    if (!p) continue;
    const ow = openWindow(p.open);
    const when = isLate(ow, dayEnd) && (p.evening || ow.from >= dayEnd - 3 * 60) ? 'late'
      : isEarly(ow, dayStart) || (ow.from <= dayStart - 30 && ow.to <= dayStart + 2 * 60 && ow.from < 8 * 60 && dayStart <= 10 * 60) ? 'early' : null;
    if (!when) continue;
    timed.push({ p, when });
    leftOut.splice(i, 1);
  }
  const extra = addTimedExtras({ timed, days, dest, req, hub, mode, people, durOf, legMins, dayStarts, dayEnd, arrival: Boolean(o.arrivalFrom || o.arrivalDelay),
    budgetLeft: o.budgetTotal - (fixed + costs.entry + costs.transport), leftOut, pipeline });
  if (!sched.placed.length && !extra.ids.length) {
    return emptyResult(dest, o, {
      reason: `Nothing in ${dest.name} fits a ${fmtTime(dayStart)}–${fmtTime(dayEnd)} day with this budget. Try a longer day or a bigger budget.`,
      minBudget: undefined, leftOut, pipeline, food, stay,
    });
  }

  return {
    feasible: true,
    days,
    value: kRun.value + extra.value,
    placeIds: days.flatMap((d) => d.placeIds), // includes early starts / evenings out, in day order
    cost: { entry: costs.entry + extra.entry, transport: costs.transport + extra.transport, food, stay },
    km: sched.days.reduce((s, d) => s + d.km, 0) + extra.km,
    travelMins: sched.days.reduce((s, d) => s + d.travel, 0) + extra.mins,
    leftOut, warnings, pipeline,
    stats: { graphNodes: N, graphEdges: graph.edges, dpCells: kRun.cells, floydMs, dijkstraMs, knapsackMs: kRun.ms },
  };
}

/**
 * Signature experiences that happen before or after a normal sightseeing day (Tiger Hill sunrise,
 * a dawn boat ride, an evening aarti or light show). Each day can take one early start and one
 * evening out, best value first, while the budget allows. Whatever doesn't fit is explained.
 */
function addTimedExtras(a: {
  timed: { p: Place; when: 'early' | 'late' }[]; days: DayPlan[]; dest: Destination; req: PlanRequest; hub: { name: string; lat: number; lng: number };
  mode: TransportMode; people: number; durOf: (p: Place) => number; legMins: (km: number) => number; dayStarts: number[]; dayEnd: number;
  arrival: boolean; budgetLeft: number; leftOut: LeftOut[]; pipeline: PipelineStep[];
}) {
  const out = { ids: [] as string[], entry: 0, transport: 0, km: 0, mins: 0, value: 0 };
  const used = new Set<string>(); // "early:2", "late:0"
  let budget = a.budgetLeft;
  const ranked = a.timed.map((t) => ({ ...t, v: placeValue(t.p, a.req) })).sort((x, y) => y.v.value - x.v.value);
  for (const { p, when, v } of ranked) {
    const ow = openWindow(p.open);
    const km = roadKm(haversineKm(a.hub.lat, a.hub.lng, p.lat, p.lng), a.dest.terrain);
    const legMinsOne = Math.round(a.legMins(km));
    const walking = km < WALK_KM;
    const legCost = walking ? 0 : Math.round(km * a.mode.perKm * a.mode.vehicles);
    const dur = Math.min(a.durOf(p), ow.to - ow.from);
    const cost = p.fee * a.people + legCost * 2;
    const label = `${fmtTime(ow.from)}–${fmtTime(ow.to)}`;
    if (legMinsOne > 90) { a.leftOut.push({ placeId: p.id, reason: 'timing', detail: `Only ${label}, and about ${fmtDuration(legMinsOne)} away — too far for an early start or evening out` }); continue; }
    if (cost > budget) { a.leftOut.push({ placeId: p.id, reason: 'over_budget', detail: `Would add about ₹${cost.toLocaleString('en-IN')} — beyond your budget` }); continue; }
    let placed = false;
    for (let i = 0; i < a.days.length && !placed; i++) {
      const day = a.days[i];
      if (used.has(`${when}:${i}`) || day.destinationId !== a.dest.id) continue;
      const wd = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      if (p.closedDays.includes(wd)) continue;
      const travel = (from: string, to: string, start: number): TimelineItem =>
        ({ type: 'travel', from, to, start, end: start + legMinsOne, km: Math.round(km * 10) / 10, mins: legMinsOne, cost: legCost, mode: walking ? 'Walk' : a.mode.label });
      const why = when === 'early' ? 'worth the early start — it only happens at this hour' : 'an evening highlight, after the day’s sightseeing';
      if (when === 'early') {
        if (i === 0 && a.arrival) continue; // travelling in on day 1
        const start = ow.from, end = start + dur, leave = start - legMinsOne, back = end + legMinsOne;
        if (back > a.dayStarts[i] + 30 || leave < 3 * 60 + 30) continue;
        const rest = day.items.filter((it) => it.type !== 'start');
        const pre: TimelineItem[] = [{ type: 'start', time: leave, name: a.hub.name }];
        if (legMinsOne > 0 && km >= 0.05) pre.push(travel(a.hub.name, p.name, leave));
        pre.push({ type: 'visit', placeId: p.id, start, end, wait: 0, fee: p.fee, why, extra: 'early' });
        if (legMinsOne > 0 && km >= 0.05) pre.push(travel(p.name, a.hub.name, end));
        if (a.dayStarts[i] - back >= 30) pre.push({ type: 'meal', start: back, end: Math.min(back + 45, a.dayStarts[i]), label: 'Breakfast' });
        day.items = [...pre, ...rest];
        day.placeIds = [p.id, ...day.placeIds];
      } else {
        const endIt = day.items[day.items.length - 1];
        const backAt = endIt?.type === 'end' ? endIt.time : a.dayStarts[i];
        const leave = Math.max(backAt + 20, ow.from - legMinsOne);
        const start = Math.max(leave + legMinsOne, ow.from);
        const end = Math.min(start + dur, ow.to); // a shorter visit is fine for a show or an aarti…
        if (end - start < Math.min(45, dur) || end + legMinsOne > 23 * 60 + 30) continue; // …but not a rushed one
        const items: TimelineItem[] = day.items.filter((it) => it.type !== 'end');
        if (start - backAt >= 75) items.push({ type: 'meal', start: backAt + 15, end: backAt + 60, label: 'Rest and an early dinner' });
        if (legMinsOne > 0 && km >= 0.05) items.push(travel(a.hub.name, p.name, start - legMinsOne));
        items.push({ type: 'visit', placeId: p.id, start, end, wait: 0, fee: p.fee, why, extra: 'late' });
        if (legMinsOne > 0 && km >= 0.05) items.push(travel(p.name, a.hub.name, end));
        items.push({ type: 'end', time: end + (km >= 0.05 ? legMinsOne : 0), name: a.hub.name });
        day.items = items;
        day.placeIds = [...day.placeIds, p.id];
      }
      if (day.note) day.note = undefined;
      day.km += Math.round(km * 2);
      day.travelMins += legMinsOne * 2;
      used.add(`${when}:${i}`);
      budget -= cost;
      out.ids.push(p.id); out.entry += p.fee * a.people; out.transport += legCost * 2; out.km += km * 2; out.mins += legMinsOne * 2; out.value += v.value;
      placed = true;
    }
    if (!placed) a.leftOut.push({ placeId: p.id, reason: 'timing', detail: `Only ${label} — no day had room for an ${when === 'early' ? 'early start' : 'evening out'}` });
  }
  if (out.ids.length) a.pipeline.push({ step: 'Early starts and evenings out', count: out.ids.length, note: 'sunrise and evening experiences added around the day', algorithm: 'Greedy by value' });
  return out;
}

/** A sunrise-hour experience (over by mid-morning) on a day that starts in the morning anyway. */
const isEarly = (ow: { from: number; to: number }, dayStart: number) =>
  ow.from < 8 * 60 && ow.to <= Math.max(dayStart + 60, 9 * 60) && ow.to <= 10 * 60 && dayStart <= 10 * 60;
/** An evening experience (starts late afternoon or later) that runs past the end of the day. */
const isLate = (ow: { from: number; to: number }, dayEnd: number) =>
  ow.from >= 16 * 60 && ow.to >= dayEnd + 30 && dayEnd >= 15 * 60;

function dropDetail(reason: string, p: Place): string {
  if (reason === 'closed_day') return `Closed on ${p.closedDays.map((d) => DAYS[d]).join(', ')}, and no other day had room`;
  if (reason === 'timing') return `Open ${p.open.replace('-', '–')} — couldn't reach it inside those hours`;
  return "Didn't fit — the days were already full";
}

function emptyResult(dest: Destination, o: DestOpts, e: { reason: string; minBudget?: number; leftOut: LeftOut[]; pipeline: PipelineStep[]; food: number; stay: number }): DestResult {
  return {
    feasible: false, infeasibleReason: e.reason, minBudget: e.minBudget,
    days: Array.from({ length: o.days }, (_, i) => ({
      index: o.firstDayIndex + i, date: addDays(o.startDate, i), destinationId: dest.id, base: dest.hub,
      items: [], placeIds: [], km: 0, travelMins: 0,
    })),
    value: 0, placeIds: [],
    cost: { entry: 0, transport: 0, food: e.food, stay: e.stay }, km: 0, travelMins: 0,
    leftOut: e.leftOut, warnings: [], pipeline: e.pipeline,
    stats: { graphNodes: 0, graphEdges: 0, dpCells: 0, floydMs: 0, dijkstraMs: 0, knapsackMs: 0 },
  };
}

// ---------------------------------------------------------------------------------------------
// Scheduling

interface SimDay { items: TimelineItem[]; order: number[]; km: number; travel: number; busy: number; cost: number }
type SimOut = { ok: true; day: SimDay } | { ok: false; at: number; reason: 'timing' | 'closed_day' | 'no_time' };

function simulate(ctx: Ctx, dayIdx: number, order: number[]): SimOut {
  const { M, K, dur, cand, mode, buffer, lunch, dayEnd, hub } = ctx;
  const date = ctx.dayDates[dayIdx];
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  let t = ctx.dayStarts[dayIdx];
  let cur = 0;
  let lunchDone = lunch === 0;
  let km = 0, travel = 0, busy = 0, cost = 0;
  const items: TimelineItem[] = [{ type: 'start', time: t, name: hub.name }];
  const doLunch = () => { items.push({ type: 'meal', start: t, end: t + lunch, label: 'Lunch break' }); t += lunch; lunchDone = true; };
  const leg = (from: number, to: number, fromName: string, toName: string) => {
    const k = K[from][to], m = M[from][to];
    if (k < 0.05 && m < 1) return; // already there
    const walking = k < WALK_KM;
    const c = walking ? 0 : Math.round(k * mode.perKm * mode.vehicles);
    items.push({ type: 'travel', from: fromName, to: toName, start: t, end: t + m, km: Math.round(k * 10) / 10, mins: Math.round(m), cost: c, mode: walking ? 'Walk' : mode.label });
    km += k; travel += m; cost += c; t += m;
  };
  for (let s = 0; s < order.length; s++) {
    const p = order[s];
    const place = cand[p - 1];
    if (place.closedDays.includes(wd)) return { ok: false, at: s, reason: 'closed_day' };
    if (!lunchDone && t >= LUNCH_FROM) doLunch();
    if (!lunchDone && t + M[cur][p] >= 13 * 60 + 30 && t >= 11 * 60 + 30) doLunch();
    const fromName = cur === 0 ? hub.name : cand[cur - 1].name;
    leg(cur, p, fromName, place.name);
    const ow = openWindow(place.open);
    let start = Math.max(t, ow.from);
    const maxWait = place.evening ? 210 : 75;
    if (start - t > maxWait) return { ok: false, at: s, reason: 'timing' };
    // eat while waiting for a place to open
    if (!lunchDone && start - t >= lunch && t >= LUNCH_FROM - 30) { items.push({ type: 'meal', start: t, end: t + lunch, label: 'Lunch break' }); lunchDone = true; }
    const end = start + dur[p];
    if (end > ow.to) return { ok: false, at: s, reason: 'timing' };
    if (end + M[p][0] > dayEnd) return { ok: false, at: s, reason: 'no_time' };
    items.push({ type: 'visit', placeId: place.id, start, end, wait: Math.round(start - t), fee: place.fee, why: ctx.whys[p] });
    t = end + buffer;
    cur = p;
  }
  if (!lunchDone && t <= LUNCH_LATEST && order.length) doLunch();
  if (order.length) {
    leg(cur, 0, cur === 0 ? hub.name : cand[cur - 1].name, hub.name);
    if (t > dayEnd + 1) return { ok: false, at: order.length - 1, reason: 'no_time' };
  }
  items.push({ type: 'end', time: t, name: hub.name });
  busy = t - ctx.dayStarts[dayIdx];
  return { ok: true, day: { items, order, km, travel, busy: order.length ? busy : 0, cost } };
}

const tourLen = (M: number[][], order: number[]) => {
  let s = 0, cur = 0;
  for (const p of order) { s += M[cur][p]; cur = p; }
  return s + M[cur][0];
};

/** Nearest-neighbour tour from the start point, then 2-opt until no swap shortens it. */
function orderStops(M: number[][], stops: number[]): number[] {
  const left = new Set(stops);
  const order: number[] = [];
  let cur = 0;
  while (left.size) {
    let best = -1;
    for (const s of left) if (best === -1 || M[cur][s] < M[cur][best]) best = s;
    order.push(best); left.delete(best); cur = best;
  }
  let improved = true;
  while (improved && order.length > 2) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++)
      for (let j = i + 1; j < order.length; j++) {
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (tourLen(M, cand) + 1e-9 < tourLen(M, order)) { order.splice(0, order.length, ...cand); improved = true; }
      }
  }
  return order;
}

/** Try every position; keep the feasible one that adds the least travel. */
function cheapestInsertion(ctx: Ctx, dayIdx: number, order: number[], p: number): { order: number[]; day: SimDay } | null {
  let best: { order: number[]; day: SimDay } | null = null;
  for (let pos = 0; pos <= order.length; pos++) {
    const o = [...order.slice(0, pos), p, ...order.slice(pos)];
    const r = simulate(ctx, dayIdx, o);
    if (r.ok && (!best || r.day.travel < best.day.travel)) best = { order: o, day: r.day };
  }
  return best;
}

function scheduleAll(ctx: Ctx, chosen: number[], days: number) {
  const groups = days > 1 ? mstClusters(ctx.M, chosen, Math.min(days, chosen.length)) : [chosen];
  while (groups.length < days) groups.push([]);
  // biggest groups go to the longest days
  const est = (g: number[]) => g.reduce((s, i) => s + ctx.dur[i], 0);
  groups.sort((a, b) => est(b) - est(a));
  const dayOrder = ctx.dayStarts.map((s, i) => ({ i, len: ctx.dayEnd - s })).sort((a, b) => b.len - a.len).map((x) => x.i);
  const assigned: number[][] = Array.from({ length: days }, () => []);
  dayOrder.forEach((d, gi) => { assigned[d] = groups[gi] ?? []; });

  const result: SimDay[] = [];
  const overflow: { p: number; reason: string }[] = [];
  for (let d = 0; d < days; d++) {
    let order = orderStops(ctx.M, assigned[d]);
    // sunset and evening places belong at the end of the day
    const late = order.filter((x) => ctx.cand[x - 1].evening);
    if (late.length && late.length < order.length) {
      const moved = [...order.filter((x) => !ctx.cand[x - 1].evening), ...late];
      if (simulate(ctx, d, moved).ok) order = moved;
    }
    for (let guard = 0; guard < 30; guard++) {
      const r = simulate(ctx, d, order);
      if (r.ok) break;
      const failing = order[r.at];
      order = order.filter((x) => x !== failing);
      const again = cheapestInsertion(ctx, d, order, failing);
      if (again) { order = again.order; continue; }
      overflow.push({ p: failing, reason: r.reason });
    }
    const final = simulate(ctx, d, order);
    if (final.ok) result.push(final.day);
    else {
      for (const p of order) overflow.push({ p, reason: 'no_time' });
      result.push({ items: [], order: [], km: 0, travel: 0, busy: 0, cost: 0 });
    }
  }
  // place overflow stops on any day that still has room
  const dropped: [number, string][] = [];
  for (const { p, reason } of overflow.sort((a, b) => ctx.values[b.p] - ctx.values[a.p])) {
    let best: { d: number; order: number[]; day: SimDay } | null = null;
    for (let d = 0; d < days; d++) {
      const ins = cheapestInsertion(ctx, d, result[d].order, p);
      if (ins && (!best || ins.day.travel - result[d].travel < best.day.travel - result[best.d].travel)) best = { d, ...ins };
    }
    if (best) result[best.d] = best.day;
    else dropped.push([p, reason]);
  }
  return { days: result, placed: result.flatMap((d) => d.order), dropped };
}

function costOf(ctx: Ctx, days: SimDay[], people: number) {
  const entry = days.reduce((s, d) => s + d.order.reduce((a, p) => a + ctx.cand[p - 1].fee * people, 0), 0);
  const transport = days.reduce((s, d) => s + d.cost, 0);
  return { entry, transport };
}

// ---------------------------------------------------------------------------------------------

function assemble(
  req: PlanRequest, dests: Destination[], rs: DestResult[], alloc: number[],
  interKm: number, interCost: number, budgetTotal: number, totalMs: number, gain?: number[][],
): PlanResult {
  const people = Math.max(1, req.people);
  const days = rs.flatMap((r) => r.days);
  const placeIds = rs.flatMap((r) => r.placeIds);
  const cost = {
    entry: sum(rs.map((r) => r.cost.entry)),
    transport: sum(rs.map((r) => r.cost.transport)),
    food: sum(rs.map((r) => r.cost.food)),
    stay: sum(rs.map((r) => r.cost.stay)),
    intercity: interCost,
    total: 0,
  };
  cost.total = cost.entry + cost.transport + cost.food + cost.stay + cost.intercity;
  const feasible = rs.every((r) => r.feasible);
  const infeasible = rs.find((r) => !r.feasible);
  const pipeline: PipelineStep[] = dests.length === 1 ? rs[0].pipeline : [
    { step: `${dests.length} destinations, ${req.days} days`, count: dests.length, note: dests.map((d) => d.name).join(' → ') },
    { step: 'Days shared between cities', count: req.days, note: dests.map((d, i) => `${d.name}: ${alloc[i]}`).join(' · '), algorithm: 'Resource allocation (DP)' },
    ...rs.flatMap((r, i) => r.pipeline.slice(-3).map((p) => ({ ...p, step: `${dests[i].name} — ${p.step}` }))),
  ];
  const window = toMin(req.dayEnd) - toMin(req.dayStart);
  const name = dests.length === 1 ? dests[0].name : dests.map((d) => d.name).join(', ').replace(/, ([^,]*)$/, ' & $1');
  const title = req.days === 1
    ? window <= 6 * 60 ? `${Math.round(window / 60)} hours in ${name}` : `A day in ${name}`
    : `${req.days} days in ${name}`;
  const warnings = [...new Set(rs.flatMap((r) => r.warnings))];
  if (interKm > 0) warnings.push(`Includes about ${Math.round(interKm)} km of driving between cities (≈₹${interCost.toLocaleString('en-IN')}).`);
  return {
    feasible,
    infeasibleReason: infeasible?.infeasibleReason,
    minBudget: infeasible?.minBudget,
    request: req,
    title,
    days,
    totals: {
      value: Math.round(sum(rs.map((r) => r.value)) * 10) / 10,
      places: placeIds.length,
      km: Math.round(sum(rs.map((r) => r.km)) + interKm),
      travelMins: Math.round(sum(rs.map((r) => r.travelMins))),
      people,
      budgetTotal,
      cost,
    },
    placeIds,
    allocation: dests.length > 1 ? dests.map((d, i) => ({ destinationId: d.id, days: alloc[i], value: round1(gain ? gain[i][alloc[i]] : 0) })) : undefined,
    leftOut: rs.flatMap((r) => r.leftOut),
    warnings,
    pipeline,
    stats: {
      graphNodes: sum(rs.map((r) => r.stats.graphNodes)),
      graphEdges: sum(rs.map((r) => r.stats.graphEdges)),
      dpCells: sum(rs.map((r) => r.stats.dpCells)),
      floydMs: round2(sum(rs.map((r) => r.stats.floydMs))),
      dijkstraMs: round2(sum(rs.map((r) => r.stats.dijkstraMs))),
      knapsackMs: round2(sum(rs.map((r) => r.stats.knapsackMs))),
      totalMs: round2(totalMs),
    },
  };
}

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
