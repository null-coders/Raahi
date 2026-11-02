import { motion } from 'framer-motion';
import { ArrowLeft, Binary, Cpu, GitBranch, Layers, Network, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { PlanResult } from '@raahi/planner';
import { Footer, Page, TopNav } from '../components/Layout';
import { CompassLoader, Counter, Empty, Reveal, SectionHead } from '../components/ui';
import { getPlan, lookupFor, type Lookup } from '../lib/planStore';
import { decodeRequest, encodeRequest } from '../lib/request';

/** "Why did Raahi choose these places?" — the algorithms, shown honestly. Doubles as the DSA demo. */
export default function Decided() {
  const [params] = useSearchParams();
  const req = decodeRequest(params.get('r'));
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  useEffect(() => {
    if (!req) return;
    Promise.all([getPlan(req, { local: true }), lookupFor(req.destinations)]).then(([p, l]) => { setPlan(p); setLookup(l); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('r')]);
  if (!req) return <Page><TopNav /><div className="pt-28"><Empty title="No trip to explain" action={<Link to="/plan" className="btn-ink">Plan a trip</Link>} /></div></Page>;
  if (!plan || !lookup) return <div className="grid min-h-screen place-items-center"><CompassLoader /></div>;
  const maxCount = Math.max(...plan.pipeline.map((p) => p.count), 1);

  return (
    <Page>
      <TopNav />
      <div className="wrap pt-28">
        <Link to={`/trip?r=${encodeRequest(req)}`} className="btn-ghost mb-8"><ArrowLeft className="h-4 w-4" /> Back to your itinerary</Link>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-display text-5xl sm:text-6xl">How Raahi <span className="italic text-gold-deep">decided</span></motion.h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">Every step that turned {plan.pipeline[0]?.count ?? 0} candidate places into your plan for {plan.title.replace(/^./, (c) => c.toLowerCase())}, and the algorithm behind each step.</p>

        {/* pipeline funnel */}
        <section className="mt-14">
          <SectionHead eyebrow="Step by step" title="From every place to your plan" />
          <div className="space-y-3">
            {plan.pipeline.map((s, i) => (
              <Reveal key={s.step + i} delay={i * 0.06}>
                <div className="card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                  <div className="h-display w-10 shrink-0 text-2xl text-gold-deep">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{s.step}</span>
                      {s.algorithm && <span className="pill bg-ink text-gold">{s.algorithm}</span>}
                    </div>
                    <div className="text-sm text-ink-muted">{s.note}</div>
                  </div>
                  <div className="flex w-full items-center gap-3 sm:w-72">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-sand-100">
                      <motion.div className="h-3 rounded-full bg-gradient-to-r from-gold to-terra" initial={{ width: 0 }} whileInView={{ width: `${(s.count / maxCount) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.08 }} />
                    </div>
                    <span className="h-display w-10 text-right text-2xl"><Counter value={s.count} /></span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {plan.allocation && (
          <section className="mt-20">
            <SectionHead eyebrow="Resource allocation (DP)" title="How the days were shared" sub="For every city Raahi first works out how good a 1-day, 2-day, 3-day… stay would be, then a multistage DP finds the split with the highest total." />
            <div className="grid gap-4 sm:grid-cols-3">
              {plan.allocation.map((a) => (
                <Reveal key={a.destinationId}><div className="card p-6 text-center"><div className="eyebrow">{lookup.destinations.get(a.destinationId)?.name}</div><div className="h-display mt-2 text-5xl"><Counter value={a.days} /></div><div className="text-sm text-ink-muted">days · value {a.value}</div></div></Reveal>
              ))}
            </div>
          </section>
        )}

        {/* algorithms + numbers */}
        <section className="mt-20">
          <SectionHead eyebrow="Under the hood" title="The algorithms in this plan" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Network, t: 'Road graph', d: `${plan.stats.graphNodes} places as vertices and ${plan.stats.graphEdges} roads as weighted edges, stored as an adjacency list.` },
              { icon: GitBranch, t: 'DFS — connected components', d: 'Finds every place reachable from your start point; seasonal road closures cut places off.' },
              { icon: Timer, t: 'Dijkstra & Floyd–Warshall', d: `Shortest travel times from your start (${plan.stats.dijkstraMs} ms) and between every pair (${plan.stats.floydMs} ms).` },
              { icon: Binary, t: '0/1 Knapsack DP', d: `Picks the best set of places for your budget and time out of ${plan.stats.dpCells.toLocaleString('en-IN')} combinations, in ${plan.stats.knapsackMs} ms.` },
              { icon: Layers, t: 'Kruskal MST clustering', d: 'Builds a minimum spanning tree of your stops and cuts its longest edges, so nearby places share a day.' },
              { icon: Cpu, t: 'Route + schedule', d: `Nearest neighbour and 2-opt order each day; every stop is checked against opening hours. Whole plan: ${plan.stats.totalMs} ms.` },
            ].map((a, i) => (
              <Reveal key={a.t} delay={i * 0.05}>
                <div className="card h-full p-6">
                  <a.icon className="mb-3 h-6 w-6 text-gold-deep" strokeWidth={1.6} />
                  <div className="h-display text-xl">{a.t}</div>
                  <p className="mt-1 text-sm text-ink-soft">{a.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </Page>
  );
}

