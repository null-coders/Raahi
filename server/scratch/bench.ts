// Quick sweep: plan every destination with a few typical requests and report how many are feasible and how slow the slowest one was.
import { loadCuratedData } from '../src/loadData';
import { planTrip, parsePlanRequest } from '@raahi/planner';
const data = loadCuratedData();
let total = 0, maxMs = 0, infeasible = 0;
const combos = [
  { days: 1, budget: 3000, companions: 'solo', people: 1 },
  { days: 2, budget: 12000, companions: 'couple', people: 2, interests: ['heritage'] },
  { days: 3, budget: 20000, companions: 'family', people: 4, kids: true, interests: ['nature'] },
  { days: 1, budget: 1500, companions: 'friends', people: 4, dayStart: '14:00', dayEnd: '21:00' },
];
for (const d of data.destinations) for (const c of combos) {
  const m = d.bestMonths[Math.floor(d.bestMonths.length / 2)];
  const p = planTrip(parsePlanRequest({ destinations: [d.id], startDate: `2026-${String(m).padStart(2, '0')}-14`, ...c }), data);
  total++; maxMs = Math.max(maxMs, p.stats.totalMs);
  if (!p.feasible) infeasible++;
}
console.log({ total, infeasible, maxMs });
