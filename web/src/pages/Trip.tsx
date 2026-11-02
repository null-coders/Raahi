import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, Bookmark, BookmarkCheck, Brain, Car, CircleDollarSign, Clock, Footprints, Hourglass, Lock,
  MapPin, Navigation, Pencil, Plus, Printer, RefreshCw, Route, Share2, Sparkles, Trash2, Unlock, Users, Utensils, Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { INTEREST_LABEL, type Destination, type LeftOut, type Place, type PlanRequest, type PlanResult, type TimelineItem } from '@raahi/planner';
import { destPhotoQuery, placePhotoQuery } from '../components/cards';
import { Footer, Page, TopNav } from '../components/Layout';
import { DAY_COLORS, MapView, gmapsDir } from '../components/MapView';
import { MustTryCard } from '../components/MustTry';
import { CompassLoader, Counter, Empty, GemBadge, Photo, Reveal } from '../components/ui';
import { weather, WEATHER_TTL, type DayWeather } from '../lib/api';
import { CATEGORY_LABEL, dayLabel, duration, hm, inr, plural, weatherOf } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { mustTryFor } from '../lib/mustTry';
import { cachedPlan, getPlan, lookupFor, type Lookup } from '../lib/planStore';
import { decodeRequest, encodeRequest, isSaved, saveTrip } from '../lib/request';

const NO_OTHER = 'Every place that fits these days, budget and interests is already in this plan. Add a day, raise the budget or change interests for a different one.';
const LINES = ['Finding experiences, not just places…', 'Checking opening hours and seasons…', 'Weighing every combination against your budget…', 'Grouping nearby places into days…', 'Looking beyond the obvious…'];

export default function Trip() {
  const [params, setParams] = useSearchParams();
  const req = useMemo(() => decodeRequest(params.get('r')), [params]);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replanning, setReplanning] = useState(false);
  const first = useRef(true);
  const key = req ? encodeRequest(req) : '';

  useEffect(() => {
    if (!req) return;
    let alive = true;
    const isFirst = first.current;
    first.current = false;
    if (!isFirst) setReplanning(true);
    setError(null);
    // a short pause on a fresh plan lets the loading story play; reopening a plan (Back/Forward) is instant
    const minWait = isFirst && !cachedPlan(req) ? new Promise((r) => setTimeout(r, 1300)) : Promise.resolve();
    Promise.all([getPlan(req, { local: !isFirst }), lookupFor(req.destinations), minWait])
      .then(([p, l]) => { if (alive) { setPlan(p); setLookup(l); } })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Something went wrong'))
      .finally(() => alive && setReplanning(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (patch: Partial<PlanRequest>) => {
    if (!req) return;
    setParams({ r: encodeRequest({ ...req, ...patch }) }, { replace: true });
  };

  // A budget that can't cover food and stay shouldn't end in a dead end: build the plan at the
  // smallest workable budget (with a little room) and say so clearly at the top.
  const [raised, setRaised] = useState<{ from: number; to: number } | null>(null);
  useEffect(() => {
    if (!plan || plan.feasible || !plan.minBudget || replanning || !req) return;
    if (plan.request.budget !== req.budget || plan.request.budgetType !== req.budgetType) return;
    const from = req.budgetType === 'total' ? req.budget : req.budget * req.people;
    const to = Math.ceil((plan.minBudget * 1.15) / 500) * 500;
    if (to <= from) return;
    setRaised((r) => r ?? { from, to });
    update({ budgetType: 'total', budget: to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, replanning]);

  if (!req) return <Page><TopNav /><div className="pt-28"><Empty title="We lost your plan" action={<Link to="/plan" className="btn-ink">Start over</Link>}>This link doesn't contain a trip. Let's build it again.</Empty></div></Page>;
  if (error && !plan) return <Page><TopNav /><div className="pt-28"><Empty icon={AlertTriangle} title="The request didn't go through" action={<button className="btn-ink" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /> Try again</button>}>{error}</Empty></div></Page>;
  if (!plan || !lookup) return <Loading />;
  if (!plan.feasible && plan.minBudget && !raised) return <Loading />; // about to re-plan at a workable budget
  return <Itinerary plan={plan} lookup={lookup} update={update} replanning={replanning} raised={raised} onDismissRaised={() => setRaised(null)} />;
}

function Loading() {
  const [i, setI] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LINES.length), 1600);
    const s = setTimeout(() => setSlow(true), 6000);
    return () => { clearInterval(t); clearTimeout(s); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-cream" role="status" aria-live="polite">
      <motion.div className="pointer-events-none absolute h-[520px] w-[520px] rounded-full bg-gold/20 blur-3xl" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 4, repeat: Infinity }} />
      <div className="relative flex flex-col items-center text-center">
        <CompassLoader size={96} />
        <AnimatePresence mode="wait">
          <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-8 max-w-xs text-lg text-ink-soft">{LINES[i]}</motion.p>
        </AnimatePresence>
        {slow && <p className="mt-2 text-xs text-ink-muted">This is taking a little longer than usual.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

function Itinerary({ plan, lookup, update, replanning, raised, onDismissRaised }: {
  plan: PlanResult; lookup: Lookup; update: (p: Partial<PlanRequest>) => void; replanning: boolean;
  raised: { from: number; to: number } | null; onDismissRaised: () => void;
}) {
  const req = plan.request;
  const [day, setDay] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [saved, setSaved] = useState(() => isSaved(req));
  const [toast, setToast] = useState<string | null>(null);
  const dests = req.destinations.map((id) => lookup.destinations.get(id)!).filter(Boolean);
  const mainDest = dests[0];
  const wx = useWeather(dests, req);
  useEffect(() => { if (day >= plan.days.length) setDay(0); }, [plan.days.length, day]);
  useEffect(() => { setSaved(isSaved(req)); }, [req]);
  const flash = (m: string, ms = 2600) => { setToast(m); setTimeout(() => setToast(null), ms); };

  // "Show me another plan": push the places already shown down the list (they stay available as a
  // fallback), keep growing that list on every click, and start the cycle again once most places are used.
  const asked = useRef<string | null>(null);
  const idsKey = (ids: string[]) => [...ids].sort().join();
  const another = () => {
    const keep = new Set(req.mustInclude);
    let avoid = [...new Set([...req.avoid, ...plan.placeIds])].filter((id) => !keep.has(id));
    if (avoid.length >= lookup.places.size * 0.8) avoid = plan.placeIds.filter((id) => !keep.has(id));
    if (idsKey(avoid) === idsKey(req.avoid)) { flash(NO_OTHER, 6500); return; }
    asked.current = idsKey(plan.placeIds);
    update({ avoid });
  };
  useEffect(() => {
    if (!asked.current || replanning) return;
    const same = idsKey(plan.placeIds) === asked.current;
    asked.current = null;
    flash(same ? NO_OTHER : 'Here’s a different plan', same ? 6500 : 2200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, replanning]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: plan.title, text: `My Raahi plan: ${plan.title}`, url });
      else { await navigator.clipboard.writeText(url); flash('Link copied'); }
    } catch { /* cancelled */ }
  };
  const save = () => { saveTrip(plan); setSaved(true); flash('Saved to this device'); };
  const lastDate = plan.days[plan.days.length - 1]?.date ?? req.startDate;
  const people = req.people;
  const total = plan.totals.cost.total;

  if (!plan.feasible) {
    return (
      <Page>
        <TopNav />
        <div className="wrap pt-28">
          <Empty icon={Wallet} title={plan.infeasibleReason?.includes('fits') ? "We couldn't fit anything in" : "That budget's a little tight"}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                {plan.minBudget && <button className="btn-ink" onClick={() => update({ budgetType: 'total', budget: plan.minBudget! })}>Use {inr(plan.minBudget)} total</button>}
                <Link to={`/plan?r=${encodeRequest(req)}`} className="btn-ghost"><Pencil className="h-4 w-4" /> Adjust your trip</Link>
              </div>
            }>
            {plan.infeasibleReason}{plan.minBudget ? ` The cheapest workable plan needs about ${inr(plan.minBudget)} for your group.` : ''}
          </Empty>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <TopNav overHero />
      {/* ---------- hero ---------- */}
      <section className="relative h-[62vh] min-h-[460px] overflow-hidden bg-ink">
        {mainDest && <Photo query={destPhotoQuery(mainDest, 6)} index={1} alt={mainDest.name} className="absolute inset-0" kenburns large />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/30" />
        <div className="wrap relative flex h-full flex-col justify-end pb-24 text-white">
          <Link to={`/plan?r=${encodeRequest(req)}`} className="no-print mb-auto mt-24 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur hover:bg-white/25"><ArrowLeft className="h-4 w-4" /> Edit trip</Link>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-2 text-sm text-white/80">Trip to</div>
            <h1 className="h-display text-5xl leading-none sm:text-7xl">{plan.title.replace(/^.* in /, '')}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="pill bg-white/15 px-3 py-1.5 text-white backdrop-blur">{dayLabel(req.startDate)}{plan.days.length > 1 ? ` – ${dayLabel(lastDate)}` : ''}</span>
              <span className="pill bg-white/15 px-3 py-1.5 text-white backdrop-blur capitalize"><Users className="h-3.5 w-3.5" /> {req.companions}{people > 1 ? ` · ${people}` : ''}</span>
              {req.interests.slice(0, 3).map((i) => <span key={i} className="pill bg-white/15 px-3 py-1.5 text-white backdrop-blur">{INTEREST_LABEL[i]}</span>)}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- stats ---------- */}
      <div className="wrap relative z-10 -mt-14">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card grid grid-cols-2 gap-5 p-5 sm:p-6 lg:grid-cols-4">
          <BigStat icon={Clock} label={plan.days.length > 1 ? 'Days' : 'Hours'} value={plan.days.length > 1 ? plan.days.length : Math.round((Number(req.dayEnd.slice(0, 2)) * 60 + Number(req.dayEnd.slice(3)) - Number(req.dayStart.slice(0, 2)) * 60 - Number(req.dayStart.slice(3))) / 60)} />
          <BigStat icon={MapPin} label="Places" value={plan.totals.places} />
          <BudgetRing used={total} budget={plan.totals.budgetTotal} perPerson={total / people} people={people} />
          <BigStat icon={Route} label="On the road" value={Math.round(plan.totals.travelMins / 60 * 10) / 10} suffix=" hr" sub={`About ${plan.totals.km} km (estimated)`} />
        </motion.div>
      </div>

      {raised && plan.feasible && (
        <div className="wrap mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gold-soft px-5 py-3 text-sm text-ink">
            <span className="flex items-start gap-3"><Wallet className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />Your budget of {inr(raised.from)} didn't cover food and stay here, so this plan uses {inr(raised.to)} for your group.</span>
            <span className="flex gap-2">
              <Link to={`/plan?r=${encodeRequest(req)}`} className="btn-ghost !px-4 !py-2"><Pencil className="h-4 w-4" /> Change trip</Link>
              <button className="btn-ghost !px-4 !py-2" onClick={onDismissRaised}>OK</button>
            </span>
          </div>
        </div>
      )}

      {plan.warnings.length > 0 && (
        <div className="wrap mt-6 space-y-2">
          {plan.warnings.map((w) => (
            <motion.div key={w} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 rounded-3xl bg-gold-soft px-5 py-3 text-sm text-ink"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />{w}</motion.div>
          ))}
        </div>
      )}

      {/* ---------- actions ---------- */}
      <div className="wrap no-print mt-6 flex flex-wrap gap-2">
        <button className={saved ? 'btn-sand' : 'btn-ink'} onClick={save}>{saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{saved ? 'Saved' : 'Save trip'}</button>
        <button className="btn-ghost" onClick={share}><Share2 className="h-4 w-4" /> Share</button>
        <button className="btn-ghost" disabled={replanning} onClick={another}><RefreshCw className={`h-4 w-4 ${replanning ? 'animate-spin' : ''}`} /> Show me another plan</button>
        <Link className="btn-ghost" to={`/decided?r=${encodeRequest(req)}`}><Brain className="h-4 w-4" /> How Raahi decided</Link>
        <button className="btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
      </div>

      {/* ---------- days ---------- */}
      <div className={`wrap mt-10 grid gap-8 transition-opacity lg:grid-cols-[1.1fr_1fr] ${replanning ? 'opacity-60' : ''}`}>
        <div>
          <div className="no-print sticky top-16 z-20 -mx-4 mb-6 bg-cream/90 px-4 py-3 backdrop-blur sm:top-20">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {plan.days.map((d, i) => {
                const w = wx.get(d.date);
                return (
                  <button key={d.date + i} onClick={() => setDay(i)} className="relative shrink-0 rounded-2xl px-4 py-2.5 text-left">
                    {day === i && <motion.span layoutId="day-tab" className="absolute inset-0 rounded-2xl bg-ink shadow-soft" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                    <span className={`relative block text-xs font-semibold ${day === i ? 'text-gold' : 'text-ink-muted'}`}>Day {i + 1} {w && weatherOf(w.code).icon}</span>
                    <span className={`relative block text-sm font-semibold ${day === i ? 'text-white' : 'text-ink'}`}>{dayLabel(d.date)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* enter-only animation: an exit-then-enter ("wait") transition can leave the day empty when tabs are tapped quickly */}
          <motion.div key={day + plan.days[day]?.date + plan.days[day]?.placeIds.join()} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
            {plan.days[day] && <DayTimeline plan={plan} dayIdx={day} lookup={lookup} req={req} update={update} setHover={setHover} weather={wx.get(plan.days[day].date)} />}
          </motion.div>
        </div>
        <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
          <DayMap plan={plan} dayIdx={day} lookup={lookup} hover={hover} />
        </div>
      </div>

      <TripMustTry destIds={req.destinations} lookup={lookup} />

      <div className="wrap mt-16 grid gap-8 lg:grid-cols-2">
        <Reveal><Costs plan={plan} /></Reveal>
        <Reveal delay={0.1}><WhatIf req={req} update={update} replanning={replanning} /></Reveal>
      </div>
      <div className="wrap mt-8"><Reveal><LeftOutList items={plan.leftOut} lookup={lookup} req={req} update={update} /></Reveal></div>

      {/* mobile total bar */}
      <div className="no-print fixed inset-x-0 bottom-24 z-30 px-4 md:hidden">
        <div className="flex items-center justify-between rounded-full bg-ink py-2 pl-6 pr-2 text-white shadow-lift">
          <div><div className="text-[10px] uppercase tracking-wider text-white/60">Total</div><div className="font-semibold">{inr(total / people)}<span className="text-xs text-white/60"> /person</span></div></div>
          <button onClick={save} className="btn-gold !py-2.5">{saved ? 'Saved' : 'Save trip'}</button>
        </div>
      </div>
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} role="status" className="fixed bottom-28 left-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 rounded-3xl bg-ink px-5 py-3 text-center text-sm font-semibold text-white shadow-lift md:bottom-8">
        {toast}
        {toast === NO_OTHER && req.days < 14 && <button className="btn-gold mx-auto mt-3 !py-2" onClick={() => { setToast(null); update({ days: req.days + 1 }); }}><Plus className="h-4 w-4" /> Add a day</button>}
      </motion.div>}</AnimatePresence>
      <Footer />
    </Page>
  );
}

/** Alongside the plan: what to eat and do in each place you are visiting. */
function TripMustTry({ destIds, lookup }: { destIds: string[]; lookup: Lookup }) {
  const { data } = useAsync(() => Promise.all(destIds.map((id) => mustTryFor(id))), [destIds.join()]);
  if (!data?.some((l) => l.length)) return null;
  return (
    <div className="no-print wrap mt-16 space-y-10">
      {destIds.map((id, k) => {
        const items = (data[k] ?? []).slice(0, 8);
        if (!items.length) return null;
        const name = lookup.destinations.get(id)?.name ?? '';
        return (
          <section key={id}>
            <Reveal>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <div className="eyebrow mb-2">Taste &amp; try</div>
                  <h2 className="h-display text-3xl sm:text-4xl">While you're in <span className="italic text-gold-deep">{name}</span></h2>
                </div>
                <Link to={`/d/${id}#must-try`} className="btn-ghost shrink-0 !py-2 text-sm">See all</Link>
              </div>
            </Reveal>
            <div className="snap-row -mx-4 px-4">
              {items.map((it, i) => <div key={it.id} className="w-[78%] shrink-0 snap-start sm:w-[290px]"><MustTryCard item={it} index={i} /></div>)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BigStat({ icon: Icon, label, value, suffix = '', sub }: { icon: typeof Clock; label: string; value: number; suffix?: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sand-100"><Icon className="h-5 w-5" strokeWidth={1.7} /></div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="h-display text-3xl leading-none"><Counter value={value} format={(n) => (Number.isInteger(value) ? Math.round(n).toString() : n.toFixed(1)) + suffix} /></div>
        {sub && <div className="mt-0.5 text-[11px] text-ink-muted">{sub}</div>}
      </div>
    </div>
  );
}

function BudgetRing({ used, budget, perPerson, people }: { used: number; budget: number; perPerson: number; people: number }) {
  const pct = Math.min(1, used / Math.max(1, budget));
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90 shrink-0">
        <circle cx="26" cy="26" r={r} stroke="#F3EADB" strokeWidth="6" fill="none" />
        <motion.circle cx="26" cy="26" r={r} stroke={pct > 0.92 ? '#D9653B' : '#C9965B'} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Budget used</div>
        <div className="h-display text-3xl leading-none"><Counter value={used} format={(n) => inr(n)} /></div>
        <div className="mt-0.5 text-[11px] text-ink-muted">of {inr(budget)}{people > 1 ? ` · ${inr(perPerson)}/person` : ''}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

function DayTimeline({ plan, dayIdx, lookup, req, update, setHover, weather: w }: {
  plan: PlanResult; dayIdx: number; lookup: Lookup; req: PlanRequest; update: (p: Partial<PlanRequest>) => void; setHover: (id: string | null) => void; weather?: DayWeather;
}) {
  const day = plan.days[dayIdx];
  const dest = lookup.destinations.get(day.destinationId);
  const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
  let n = 0;
  const coordsOf = (name: string) => {
    if (name === day.base.name) return day.base;
    const p = [...lookup.places.values()].find((x) => x.name === name);
    if (p) return p;
    const d = [...lookup.destinations.values()].find((x) => x.hub.name === name);
    return d?.hub;
  };
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">{dest?.name}</div>
          <h3 className="h-display text-3xl">{day.note ?? `Day ${dayIdx + 1}`}</h3>
        </div>
        {w && <div className="rounded-full bg-white px-4 py-2 text-sm shadow-soft">{weatherOf(w.code).icon} {w.max}° / {w.min}° {w.rain >= 50 && <span className="text-terra">· {w.rain}% rain</span>}</div>}
      </div>
      <ol className="relative">
        <span className="absolute bottom-6 left-[19px] top-6 w-0.5 bg-gradient-to-b from-gold via-ink/15 to-gold" aria-hidden />
        {day.items.map((it, i) => {
          if (it.type === 'visit') n++;
          return (
            <motion.li key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.05, 0.6) }} className="relative pl-14">
              <Item it={it} num={n} color={color} lookup={lookup} req={req} update={update} setHover={setHover} dest={dest} coordsOf={coordsOf} />
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

function Item({ it, num, color, lookup, req, update, setHover, dest, coordsOf }: {
  it: TimelineItem; num: number; color: string; lookup: Lookup; req: PlanRequest; update: (p: Partial<PlanRequest>) => void;
  setHover: (id: string | null) => void; dest?: Destination; coordsOf: (n: string) => { lat: number; lng: number } | undefined;
}) {
  if (it.type === 'start' || it.type === 'end') {
    return (
      <div className="pb-6">
        <span className="absolute left-2 top-0 grid h-9 w-9 place-items-center rounded-xl bg-ink text-gold shadow-soft">★</span>
        <div className="text-xs font-semibold text-ink-muted">{hm(it.time)}</div>
        <div className="font-semibold">{it.type === 'start' ? `Start from ${it.name}` : `Back at ${it.name}`}</div>
      </div>
    );
  }
  if (it.type === 'travel') {
    const a = coordsOf(it.from), b = coordsOf(it.to);
    const Walk = it.mode === 'Walk';
    return (
      <div className="pb-6">
        <span className="absolute left-[11px] top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-sand-200">{Walk ? <Footprints className="h-2.5 w-2.5" /> : <Car className="h-2.5 w-2.5" />}</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
          <span>About {duration(it.mins)} · {it.km} km {it.mode === 'Road transfer' ? 'between cities' : `by ${it.mode.toLowerCase()}`}</span>
          {it.cost > 0 && <span className="text-ink-muted">≈ {inr(it.cost)}</span>}
          {a && b && <a href={gmapsDir(a, b)} target="_blank" rel="noreferrer" className="no-print inline-flex items-center gap-1 font-semibold text-gold-deep hover:underline"><Navigation className="h-3 w-3" /> Directions</a>}
        </div>
      </div>
    );
  }
  if (it.type === 'meal') {
    return (
      <div className="pb-6">
        <span className="absolute left-2 top-0 grid h-9 w-9 place-items-center rounded-xl bg-terra-soft text-terra"><Utensils className="h-4 w-4" /></span>
        <div className="text-xs font-semibold text-ink-muted">{hm(it.start)} – {hm(it.end)}</div>
        <div className="font-semibold">{it.label}</div>
        {dest && <div className="text-sm text-ink-soft">Try {dest.dishes.slice(0, 2).join(' or ')}.</div>}
      </div>
    );
  }
  const p = lookup.places.get(it.placeId);
  if (!p) return null;
  const locked = req.mustInclude.includes(p.id);
  return (
    <div className="pb-6" onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
      <span className="absolute left-0.5 top-3 grid h-10 w-10 place-items-center rounded-full border-4 border-cream text-sm font-bold text-white shadow-soft" style={{ background: color }}>{num}</span>
      <motion.div whileHover={{ y: -3 }} className="card group flex gap-4 overflow-hidden p-3 pr-4">
        <Link to={`/p/${p.id}`} className="shrink-0"><Photo query={placePhotoQuery(p, dest?.name)} alt={p.name} icon={p.category} className="h-28 w-28 rounded-3xl sm:h-32 sm:w-36" credit={false} /></Link>
        <div className="min-w-0 flex-1 py-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
            <span>{hm(it.start)} – {hm(it.end)}</span>
            {it.wait > 10 && <span className="inline-flex items-center gap-1 text-gold-deep"><Hourglass className="h-3 w-3" /> opens in {duration(it.wait)}</span>}
            {it.extra && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] text-gold-deep">{it.extra === 'early' ? '🌅 Early start' : '🌙 Evening out'}</span>}
          </div>
          <Link to={`/p/${p.id}`} className="h-display mt-0.5 block text-xl leading-tight hover:text-gold-deep">{p.name}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="pill bg-sand-100 text-ink-soft">{CATEGORY_LABEL[p.category]}</span>
            <span className="pill bg-sand-100 text-ink-soft">{p.fee ? `${inr(p.fee)} entry` : 'Free'}</span>
            {p.gem && <GemBadge small />}
          </div>
          <p className="mt-1.5 text-[13px] italic text-ink-soft">Why: {it.why}</p>
          <div className="no-print mt-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
            <button title={locked ? 'Unlock' : 'Always keep this stop'} onClick={() => update({ mustInclude: locked ? req.mustInclude.filter((x) => x !== p.id) : [...req.mustInclude, p.id] })} className="rounded-full bg-sand-100 p-2 hover:bg-gold-soft">{locked ? <Lock className="h-3.5 w-3.5 text-gold-deep" /> : <Unlock className="h-3.5 w-3.5" />}</button>
            <button title="Remove from plan" onClick={() => update({ exclude: [...req.exclude, p.id], mustInclude: req.mustInclude.filter((x) => x !== p.id) })} className="rounded-full bg-sand-100 p-2 hover:bg-terra-soft"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function DayMap({ plan, dayIdx, lookup, hover }: { plan: PlanResult; dayIdx: number; lookup: Lookup; hover: string | null }) {
  const [all, setAll] = useState(false);
  const days = all ? plan.days.map((d, i) => ({ d, i })) : [{ d: plan.days[dayIdx], i: dayIdx }];
  const points = days.flatMap(({ d, i }) => d.placeIds.map((id, k) => {
    const p = lookup.places.get(id)!;
    return { id, lat: p.lat, lng: p.lng, title: p.name, label: String(k + 1), color: DAY_COLORS[i % DAY_COLORS.length], href: `/p/${id}`, sub: `Day ${i + 1}` };
  }));
  const routes = days.filter(({ d }) => d.placeIds.length).map(({ d, i }) => ({
    key: `${d.date}-${i}-${d.placeIds.join()}`,
    color: DAY_COLORS[i % DAY_COLORS.length],
    points: [[d.base.lat, d.base.lng], ...d.placeIds.map((id) => { const p = lookup.places.get(id)!; return [p.lat, p.lng]; }), [d.base.lat, d.base.lng]] as [number, number][],
  }));
  const base = plan.days[dayIdx]?.base;
  return (
    <div className="relative h-[360px] overflow-hidden rounded-5xl shadow-soft lg:h-full">
      <MapView className="h-full w-full" points={points} routes={routes} hub={base} active={hover} />
      <div className="no-print absolute right-3 top-3 z-[500] flex rounded-full bg-white p-1 shadow-soft">
        {[false, true].map((v) => <button key={String(v)} onClick={() => setAll(v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${all === v ? 'bg-ink text-white' : 'text-ink-soft'}`}>{v ? 'All days' : 'This day'}</button>)}
      </div>
      <div className="absolute bottom-3 left-3 z-[500] rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-ink-soft shadow-soft">Lines are straight-line estimates between stops</div>
    </div>
  );
}

function Costs({ plan }: { plan: PlanResult }) {
  const c = plan.totals.cost;
  const rows = [
    { k: 'Stay', v: c.stay, color: 'bg-ink' },
    { k: 'Food', v: c.food, color: 'bg-terra' },
    { k: 'Local transport', v: c.transport, color: 'bg-gold' },
    { k: 'Entry fees', v: c.entry, color: 'bg-sage' },
    { k: 'Between cities', v: c.intercity, color: 'bg-sky' },
  ].filter((r) => r.v > 0);
  const max = Math.max(plan.totals.budgetTotal, c.total);
  return (
    <div className="card h-full p-6">
      <div className="mb-1 flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-gold-deep" /><h3 className="h-display text-2xl">Where the money goes</h3></div>
      <p className="mb-5 text-sm text-ink-muted">Estimates for {plural(plan.totals.people, 'person', 'people')} — entry fees are for Indian adults.</p>
      <div className="mb-6 flex h-4 overflow-hidden rounded-full bg-sand-100">
        {rows.map((r, i) => (
          <motion.div key={r.k} className={r.color} initial={{ width: 0 }} whileInView={{ width: `${(r.v / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.12 }} />
        ))}
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${r.color}`} />{r.k}</span><span className="font-semibold">{inr(r.v)}</span></div>
        ))}
        <div className="flex items-center justify-between border-t border-ink/10 pt-3 font-semibold"><span>Total</span><span>{inr(c.total)} <span className="font-normal text-ink-muted">of {inr(plan.totals.budgetTotal)}</span></span></div>
      </div>
    </div>
  );
}

function WhatIf({ req, update, replanning }: { req: PlanRequest; update: (p: Partial<PlanRequest>) => void; replanning: boolean }) {
  const [budget, setBudget] = useState(req.budget);
  useEffect(() => setBudget(req.budget), [req.budget]);
  useEffect(() => {
    if (budget === req.budget) return;
    const t = setTimeout(() => update({ budget }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget]);
  return (
    <div className="card h-full p-6">
      <div className="mb-1 flex items-center gap-2"><Sparkles className="h-5 w-5 text-gold-deep" /><h3 className="h-display text-2xl">What if…</h3>{replanning && <span className="ml-auto text-xs text-ink-muted">Re-planning…</span>}</div>
      <p className="mb-6 text-sm text-ink-muted">Move a slider — the same algorithms re-plan instantly in your browser.</p>
      <label className="block">
        <div className="mb-2 flex justify-between text-sm"><span className="font-semibold">Budget {req.budgetType === 'per_person' ? 'per person' : 'total'}</span><span className="h-display text-lg">{inr(budget)}</span></div>
        <input type="range" min={Math.max(500, Math.round(req.budget * 0.3))} max={Math.round(req.budget * 2.5)} step={req.budget > 20000 ? 1000 : 250} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full accent-[#C9965B]" />
      </label>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-2 text-sm font-semibold">Days</div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost !p-2.5" disabled={req.days <= req.destinations.length} onClick={() => update({ days: req.days - 1 })}>−</button>
            <span className="h-display w-8 text-center text-2xl">{req.days}</span>
            <button className="btn-ghost !p-2.5" disabled={req.days >= 14} onClick={() => update({ days: req.days + 1 })}><Plus className="h-4 w-4" /></button>
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold">Pace</div>
          <select value={req.pace} onChange={(e) => update({ pace: e.target.value as PlanRequest['pace'] })} className="input !rounded-full !py-2.5 capitalize">
            {['relaxed', 'balanced', 'packed'].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <label className="mt-6 block">
        <div className="mb-2 flex justify-between text-sm"><span className="font-semibold">Popular ↔ Off-beat</span><span className="text-ink-muted">{req.discovery}%</span></div>
        <input type="range" min={0} max={100} step={10} value={req.discovery} onChange={(e) => update({ discovery: Number(e.target.value) })} className="w-full accent-[#C9965B]" />
      </label>
    </div>
  );
}

const REASON: Record<LeftOut['reason'], { label: string; tone: string }> = {
  closed_season: { label: 'Closed this season', tone: 'bg-sky-soft' }, closed_day: { label: 'Closed on your dates', tone: 'bg-sky-soft' },
  road_closed: { label: 'Road closed', tone: 'bg-sky-soft' }, not_suitable: { label: 'Not right for your group', tone: 'bg-terra-soft' },
  interest: { label: 'Not your interests', tone: 'bg-sand-100' }, over_budget: { label: 'Over budget', tone: 'bg-terra-soft' },
  no_time: { label: 'No time left', tone: 'bg-gold-soft' }, timing: { label: 'Opening hours clash', tone: 'bg-gold-soft' },
  too_far: { label: 'Too far for a day trip', tone: 'bg-sky-soft' }, excluded: { label: 'You removed it', tone: 'bg-sand-100' },
  lower_value: { label: 'Lower match for you', tone: 'bg-sand-100' },
};

function LeftOutList({ items, lookup, req, update }: { items: LeftOut[]; lookup: Lookup; req: PlanRequest; update: (p: Partial<PlanRequest>) => void }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const shown = open ? items : items.slice(0, 6);
  return (
    <div className="card p-6">
      <h3 className="h-display text-2xl">What we left out — and why</h3>
      <p className="mb-5 mt-1 text-sm text-ink-muted">Nothing is hidden. Add any place back and Raahi will re-plan around it.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((l) => {
          const p = lookup.places.get(l.placeId) as Place | undefined;
          if (!p) return null;
          const canAdd = ['no_time', 'lower_value', 'over_budget', 'excluded', 'timing'].includes(l.reason);
          return (
            <div key={l.placeId} className="flex min-w-0 items-center gap-3 rounded-3xl border border-ink/5 p-3">
              <Photo query={placePhotoQuery(p)} alt={p.name} icon={p.category} className="h-14 w-14 shrink-0 rounded-2xl" credit={false} />
              <div className="min-w-0 flex-1">
                <Link to={`/p/${p.id}`} className="block truncate font-semibold hover:text-gold-deep">{p.name}</Link>
                <span className={`pill mt-1 ${REASON[l.reason].tone} text-ink`}>{REASON[l.reason].label}</span>
                <div className="mt-1 text-xs text-ink-muted">{l.detail}</div>
              </div>
              {canAdd && (
                <button title="Add to plan" onClick={() => update({ mustInclude: [...req.mustInclude, p.id], exclude: req.exclude.filter((x) => x !== p.id) })} className="no-print rounded-full bg-ink p-2 text-white hover:bg-ink-2"><Plus className="h-4 w-4" /></button>
              )}
            </div>
          );
        })}
      </div>
      {items.length > 6 && <button className="btn-ghost no-print mt-4" onClick={() => setOpen(!open)}>{open ? 'Show less' : `Show all ${items.length}`}</button>}
    </div>
  );
}

function useWeather(dests: Destination[], req: PlanRequest): Map<string, DayWeather> {
  const [map, setMap] = useState(new Map<string, DayWeather>());
  const key = dests.map((d) => d.id).join() + req.startDate + req.days;
  useEffect(() => {
    const diff = (new Date(req.startDate).getTime() - Date.now()) / 86400000;
    if (diff > 15 || !dests.length) return;
    let alive = true;
    const load = (fresh: boolean) =>
      Promise.all(dests.map((d) => weather(d.lat, d.lng, req.startDate, req.days, fresh).catch(() => null)))
        .then((rs) => {
          if (!alive || rs.every((r) => !r)) return; // keep the last good forecast if a refresh fails
          const m = new Map<string, DayWeather>();
          rs.forEach((r) => r?.daily.forEach((w) => { if (!m.has(w.date)) m.set(w.date, w); }));
          setMap(m);
        });
    load(false);
    // forecasts update through the day: refresh while the trip is open and when the tab comes back
    const tick = window.setInterval(() => { if (document.visibilityState === 'visible') load(true); }, WEATHER_TTL);
    const onShow = () => { if (document.visibilityState === 'visible') load(false); };
    document.addEventListener('visibilitychange', onShow);
    return () => { alive = false; window.clearInterval(tick); document.removeEventListener('visibilitychange', onShow); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}
