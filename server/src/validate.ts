// npm run validate-data — checks every data file and prints a summary per region.
import { loadCuratedData } from './loadData';
import { planTrip, parsePlanRequest } from '@raahi/planner';

try {
  const data = loadCuratedData();
  const byRegion = new Map<string, number>();
  for (const d of data.destinations) byRegion.set(d.region, (byRegion.get(d.region) ?? 0) + 1);
  console.log(`✓ ${data.destinations.length} destinations, ${data.places.length} places`);
  for (const [r, n] of byRegion) console.log(`  ${r.padEnd(10)} ${n}`);
  // smoke-plan every destination for its ideal minimum days
  let fails = 0;
  for (const d of data.destinations) {
    const month = d.bestMonths[0];
    const date = `2026-${String(month).padStart(2, '0')}-10`;
    const plan = planTrip(parsePlanRequest({ destinations: [d.id], startDate: date, days: d.idealDays[0], budget: 25000, people: 2 }), data);
    if (!plan.feasible || plan.totals.places < Math.min(2, data.places.filter((p) => p.destinationId === d.id).length)) {
      fails++;
      console.log(`  ! ${d.id}: ${plan.feasible ? `only ${plan.totals.places} places planned` : plan.infeasibleReason}`);
    }
  }
  console.log(fails ? `${fails} destinations need attention` : '✓ every destination produces a plan');
} catch (e) {
  console.error('✗ Data problems:\n' + (e as Error).message);
  process.exit(1);
}
