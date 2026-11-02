import { describe, expect, it } from 'vitest';
import { expandDataset, openWindow, parsePlanRequest, planSimilarity, planTrip, type PlanResult, type RawDestination } from '../src';

const town: RawDestination = {
  id: 'testpur', n: 'Testpur', st: 'Rajasthan', r: 'West', ty: ['heritage'], ll: [26.9, 75.8], bm: [10, 11, 12, 1, 2],
  days: [2, 3], terr: 'city', food: 800, stay: 2000, tag: 't', ab: 'a', ppl: 'p', eat: ['x'], lang: 'Hindi', go: 'g', pop: 8,
  hub: ['Old city', 26.92, 75.82],
  places: [
    { n: 'Big Fort', c: 'fort', ll: [26.985, 75.851], m: 150, f: 100, o: '08:00-17:30', s: 10, p: 10, d: 'd' },
    { n: 'City Palace', c: 'palace', ll: [26.925, 75.824], m: 120, f: 200, o: '09:30-17:00', s: 9, p: 9, d: 'd' },
    { n: 'Wind Palace', c: 'palace', ll: [26.924, 75.827], m: 45, f: 50, o: '09:00-16:30', s: 8, p: 9, d: 'd' },
    { n: 'Observatory', c: 'heritage', ll: [26.9248, 75.8246], m: 60, f: 50, o: '09:00-16:30', s: 8, p: 7, d: 'd' },
    { n: 'Step Well', c: 'heritage', ll: [26.988, 75.855], m: 30, f: 0, o: '07:00-18:00', s: 8, p: 3, d: 'd' },
    { n: 'Lake Palace View', c: 'lake', ll: [26.953, 75.846], m: 30, f: 0, o: '24h', s: 7, p: 6, d: 'd' },
    { n: 'Night Market', c: 'market', ll: [26.919, 75.826], m: 90, f: 0, o: '17:00-22:00', s: 8, p: 6, d: 'd', a: 'n' },
    { n: 'Museum Closed Monday', c: 'museum', ll: [26.912, 75.819], m: 90, f: 40, o: '10:00-17:00', x: [1], s: 7, p: 5, d: 'd' },
    { n: 'Hill Trek', c: 'trek', ll: [26.99, 75.9], m: 180, o: '06:00-17:00', s: 8, p: 3, d: 'd', a: 'ke' },
    { n: 'Monsoon Falls', c: 'waterfall', ll: [26.8, 75.9], m: 60, mo: [7, 8, 9], s: 9, p: 4, d: 'd' },
  ],
};
const data = expandDataset([town]);

const base = (over: Record<string, unknown> = {}) => parsePlanRequest({
  destinations: ['testpur'], startDate: '2026-11-02', days: 1, dayStart: '08:30', dayEnd: '19:00',
  budget: 6000, budgetType: 'per_person', companions: 'couple', people: 2, ...over,
});

function checkTimeline(plan: PlanResult) {
  const req = plan.request;
  const [sh, sm] = req.dayStart.split(':').map(Number);
  const [eh, em] = req.dayEnd.split(':').map(Number);
  for (const day of plan.days) {
    // an early start (sunrise ride) may begin before the day; everything stays in order
    const first = day.items[0];
    let last = Math.min(sh * 60 + sm, first && first.type === 'start' ? first.time : Infinity);
    let lateOut = false;
    for (const it of day.items) {
      if (it.type === 'visit' && it.extra === 'late') lateOut = true;
      if (it.type === 'visit' && !it.extra) {
        expect(it.start).toBeGreaterThanOrEqual(sh * 60 + sm - 0.001);
        expect(it.end).toBeLessThanOrEqual(eh * 60 + em + 1);
      }
      if ('start' in it) {
        expect(it.start).toBeGreaterThanOrEqual(last - 0.001);
        expect(it.end).toBeGreaterThanOrEqual(it.start);
        last = it.end;
      }
      if (it.type === 'visit') {
        const p = data.places.find((x) => x.id === it.placeId)!;
        const w = openWindow(p.open);
        expect(it.start).toBeGreaterThanOrEqual(w.from);
        expect(it.end).toBeLessThanOrEqual(w.to);
      }
    }
    if (!lateOut) expect(last).toBeLessThanOrEqual(eh * 60 + em + 1);
  }
}

describe('planTrip', () => {
  it('builds a feasible day inside opening hours and budget', () => {
    const plan = planTrip(base(), data);
    expect(plan.feasible).toBe(true);
    expect(plan.totals.places).toBeGreaterThan(2);
    expect(plan.totals.cost.total).toBeLessThanOrEqual(plan.totals.budgetTotal);
    checkTimeline(plan);
  });

  it('never schedules a place on its closed day (Monday)', () => {
    const plan = planTrip(base({ startDate: '2026-11-02' }), data); // a Monday
    expect(plan.days[0].placeIds).not.toContain('testpur--museum-closed-monday');
    expect(plan.leftOut.find((l) => l.placeId === 'testpur--museum-closed-monday')?.reason).toBe('closed_day');
  });

  it('respects seasons', () => {
    const plan = planTrip(base(), data);
    expect(plan.leftOut.find((l) => l.placeId === 'testpur--monsoon-falls')?.reason).toBe('closed_season');
  });

  it('filters unsuitable places for kids and elders', () => {
    const plan = planTrip(base({ companions: 'family', people: 4, kids: true }), data);
    expect(plan.leftOut.find((l) => l.placeId === 'testpur--hill-trek')?.reason).toBe('not_suitable');
  });

  it('reports a minimum budget when money cannot cover the basics', () => {
    const plan = planTrip(base({ days: 3, budget: 500 }), data);
    expect(plan.feasible).toBe(false);
    expect(plan.minBudget).toBeGreaterThan(500 * 2);
  });

  it('spreads a multi-day trip over the days without repeats', () => {
    const plan = planTrip(base({ days: 3, budget: 20000 }), data);
    expect(plan.days).toHaveLength(3);
    const ids = plan.days.flatMap((d) => d.placeIds);
    expect(new Set(ids).size).toBe(ids.length);
    checkTimeline(plan);
  });

  it('lists every place of the plan once, in order', () => {
    const plan = planTrip(base({ budget: 1500 }), data);
    expect(plan.placeIds.length).toBeGreaterThan(0);
    expect(plan.placeIds).toEqual(plan.days.flatMap((d) => d.placeIds));
  });

  it('"another plan" changes the stops', () => {
    const first = planTrip(base(), data);
    const second = planTrip(base({ avoid: first.placeIds }), data);
    expect(second.placeIds).not.toEqual(first.placeIds);
    expect(planSimilarity(first.placeIds, second.placeIds)).toBeLessThan(1);
  });

  it('a few-hours evening trip picks the night market', () => {
    const plan = planTrip(base({ dayStart: '16:00', dayEnd: '21:00', interests: ['food'] }), data);
    expect(plan.days[0].placeIds).toContain('testpur--night-market');
    checkTimeline(plan);
  });

  it('adds a sunrise spot as an early start and an evening aarti as an evening out', () => {
    const t2: RawDestination = { ...town, id: 'ghatpur', n: 'Ghatpur', places: [...town.places,
      { n: 'Sunrise Point', c: 'viewpoint', ll: [26.93, 75.83], m: 60, f: 0, o: '05:00-07:00', s: 10, p: 9, d: 'd' },
      { n: 'Evening Aarti', c: 'spiritual', ll: [26.92, 75.825], m: 60, f: 0, o: '18:30-20:00', s: 10, p: 9, d: 'd', a: 'n' }] };
    const d2 = expandDataset([t2]);
    const plan = planTrip(parsePlanRequest({ ...base(), destinations: ['ghatpur'], days: 2, budget: 20000 }), d2);
    const visits = plan.days.flatMap((d) => d.items).filter((it) => it.type === 'visit');
    const early = visits.find((v) => v.type === 'visit' && v.placeId === 'ghatpur--sunrise-point');
    const late = visits.find((v) => v.type === 'visit' && v.placeId === 'ghatpur--evening-aarti');
    expect(early && early.type === 'visit' && early.extra).toBe('early');
    expect(late && late.type === 'visit' && late.extra).toBe('late');
    expect(plan.placeIds).toEqual(plan.days.flatMap((d) => d.placeIds));
    for (const d of plan.days) {
      let last = -1;
      for (const it of d.items) {
        const at = 'start' in it ? it.start : it.time;
        expect(at).toBeGreaterThanOrEqual(last - 0.001);
        last = 'end' in it && typeof it.end === 'number' ? it.end : at;
      }
    }
  });

  it('multi-city trips allocate days with the resource-allocation DP', () => {
    const second: RawDestination = { ...town, id: 'otherpur', n: 'Otherpur', ll: [27.2, 76.1], hub: ['Centre', 27.2, 76.1],
      places: town.places.map((p) => ({ ...p, ll: [p.ll[0] + 0.3, p.ll[1] + 0.3] as [number, number] })) };
    const d2 = expandDataset([town, second]);
    const plan = planTrip(parsePlanRequest({ ...base(), destinations: ['testpur', 'otherpur'], days: 4, budget: 30000 }), d2);
    expect(plan.allocation?.reduce((s, a) => s + a.days, 0)).toBe(4);
    expect(plan.days).toHaveLength(4);
    expect(plan.allocation!.every((a) => a.days >= 1)).toBe(true);
  });
});
