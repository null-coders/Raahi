import { AnimatePresence, motion } from 'framer-motion';
import { Baby, Heart, Minus, Plus, Sparkles, User, Users, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { INTERESTS, INTEREST_LABEL, type Companions, type DestinationSummary, type Interest, type Pace, type PlanRequest } from '@raahi/planner';
import { destPhotoQuery } from '../components/cards';
import { Page, TopNav } from '../components/Layout';
import { SearchBox } from '../components/SearchBox';
import { Photo } from '../components/ui';
import { api, destinationDetail } from '../lib/api';
import { inr, monthRanges, plural } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { decodeRequest, defaultRequest, tripUrl } from '../lib/request';

const COMPANIONS: { id: Companions; label: string; icon: typeof User; note: string; people: number }[] = [
  { id: 'solo', label: 'Solo', icon: User, note: 'Faster pace, local life', people: 1 },
  { id: 'couple', label: 'Couple', icon: Heart, note: 'Views, sunsets, quiet spots', people: 2 },
  { id: 'friends', label: 'Friends', icon: UsersRound, note: 'Adventure, food, nightlife', people: 4 },
  { id: 'family', label: 'Family', icon: Users, note: 'Easy pace, breaks, safe picks', people: 4 },
];
const INTEREST_ICON: Record<Interest, string> = {
  heritage: '🏰', spiritual: '🪔', nature: '🌿', views: '🏔️', water: '🌊', adventure: '🪂', wildlife: '🐅', food: '🍛', culture: '🧶', nightlife: '🌙', museums: '🏛️',
};
const LENGTHS = [
  { id: 'hours', label: 'A few hours', sub: 'Half a day' },
  { id: 'day', label: 'One day', sub: 'Full day out' },
  { id: 'multi', label: 'More days', sub: '2–14 days' },
] as const;

export default function Planner() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [req, setReq] = useState<PlanRequest>(() => {
    const fromUrl = decodeRequest(params.get('r'));
    if (fromUrl) return fromUrl;
    const d = params.get('dest');
    const r = defaultRequest(d ? [d] : []);
    const must = params.get('must');
    if (must) r.mustInclude = [must];
    return r;
  });
  const set = (patch: Partial<PlanRequest>) => setReq((r) => ({ ...r, ...patch }));
  const all = useAsync(() => api.destinations(), []);
  const dests = useMemo(() => req.destinations.map((id) => all.data?.find((d) => d.id === id)).filter(Boolean) as DestinationSummary[], [req.destinations, all.data]);
  const length = req.days > 1 ? 'multi' : timeSpan(req) <= 6 * 60 ? 'hours' : 'day';

  // when the first destination changes, suggest its ideal number of days
  useEffect(() => {
    const d = dests[0];
    if (d && !params.get('r') && req.days === 2 && d.idealDays[0] !== 2 && req.destinations.length === 1) set({ days: Math.max(1, d.idealDays[0]) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dests[0]?.id]);

  const budgetTotal = req.budgetType === 'per_person' ? req.budget * req.people : req.budget;
  const basics = dests.length
    ? Math.round(dests.reduce((s, d) => s + (d.foodPerDay * req.people * req.days) / dests.length + (req.includeStay ? (d.stayPerNight * Math.ceil(req.people / 2) * Math.max(0, req.days - 1)) / dests.length : 0), 0))
    : 0;
  // A realistic starting budget: food and stay plus entry fees and local transport (about ₹1,200 a
  // person a day). Until the traveller moves the slider it follows the trip, so a first plan never
  // fails on a budget nobody chose.
  const [budgetTouched, setBudgetTouched] = useState(() => Boolean(params.get('r')));
  const suggested = basics ? Math.ceil((basics + req.people * req.days * 1200) / 500) * 500 : 0;
  const asBudget = (total: number) => (req.budgetType === 'total' ? total : Math.ceil(total / req.people / 500) * 500);
  useEffect(() => {
    if (!budgetTouched && suggested && asBudget(suggested) !== req.budget) set({ budget: asBudget(suggested) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested, budgetTouched, req.budgetType]);
  const tooLow = basics > 0 && budgetTotal < basics;
  const ready = req.destinations.length > 0 && req.days >= req.destinations.length;
  const go = () => nav(tripUrl({ ...req, avoid: [] }));

  return (
    <Page>
      <TopNav />
      <div className="wrap grid gap-10 pt-28 lg:grid-cols-[1fr_380px]">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-display text-5xl sm:text-6xl">
            Let's plan <span className="italic text-gold-deep">your trip.</span>
          </motion.h1>
          <p className="mt-3 text-lg text-ink-soft">A few quick questions, then we'll take it from there.</p>

          <Block n={1} title="Where are you headed?" hint="Add up to 3 places for a multi-city trip.">
            <div className="flex flex-wrap gap-3">
              <AnimatePresence>
                {dests.map((d) => (
                  <motion.div key={d.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-3 shadow-soft">
                    <Photo query={destPhotoQuery(d)} alt={d.name} className="h-10 w-10 rounded-full" credit={false} />
                    <div><div className="text-sm font-semibold leading-tight">{d.name}</div><div className="text-[11px] text-ink-muted">Best {monthRanges(d.bestMonths)}</div></div>
                    <button aria-label={`Remove ${d.name}`} onClick={() => set({ destinations: req.destinations.filter((x) => x !== d.id) })} className="ml-1 rounded-full p-1 hover:bg-sand-100"><X className="h-4 w-4" /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {req.destinations.length < 3 && (
              <div className="mt-4 max-w-lg">
                <SearchBox onlyDestinations placeholder={req.destinations.length ? 'Add another destination…' : 'Search a destination…'} onPick={(h) => !req.destinations.includes(h.id) && set({ destinations: [...req.destinations, h.id], days: Math.max(req.days, req.destinations.length + 1) })} />
              </div>
            )}
          </Block>

          <Block n={2} title="When, and for how long?">
            <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
              <div>
                <label className="label" htmlFor="date">Start date</label>
                <input id="date" type="date" className="input" value={req.startDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ startDate: e.target.value })} />
              </div>
              <div>
                <span className="label">Trip length</span>
                <div className="grid grid-cols-3 gap-2">
                  {LENGTHS.map((l) => (
                    <button key={l.id} onClick={() => {
                      if (l.id === 'hours') set({ days: 1, dayStart: '15:00', dayEnd: '20:00' });
                      if (l.id === 'day') set({ days: 1, dayStart: '08:30', dayEnd: '19:00' });
                      if (l.id === 'multi') set({ days: Math.max(2, dests[0]?.idealDays[0] ?? 2), dayStart: '08:30', dayEnd: '19:00' });
                    }} className={`rounded-2xl border px-3 py-3 text-left transition ${length === l.id ? 'border-ink bg-ink text-white' : 'border-ink/10 bg-white hover:border-ink/30'}`}>
                      <div className="text-sm font-semibold">{l.label}</div><div className={`text-xs ${length === l.id ? 'text-white/70' : 'text-ink-muted'}`}>{l.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-6">
              {length === 'multi' && (
                <Stepper label="Days" value={req.days} min={Math.max(2, req.destinations.length)} max={14} onChange={(days) => set({ days })} suffix={(n) => plural(n, 'day')} />
              )}
              <TimeSelect label="Start each day at" value={req.dayStart} onChange={(dayStart) => set({ dayStart })} />
              <TimeSelect label="Be back by" value={req.dayEnd} onChange={(dayEnd) => set({ dayEnd })} />
            </div>
            {dests[0] && <StartPoint destId={dests[0].id} multi={req.destinations.length > 1} value={req.startPoint ?? null} onChange={(startPoint) => set({ startPoint })} />}
          </Block>

          <Block n={3} title="Who's coming?">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {COMPANIONS.map((c) => (
                <motion.button key={c.id} whileTap={{ scale: 0.96 }} onClick={() => set({ companions: c.id, people: c.id === 'solo' ? 1 : c.id === 'couple' ? 2 : Math.max(req.people, 3), kids: c.id === 'family' ? req.kids : false, elders: c.id === 'family' ? req.elders : false })}
                  className={`relative overflow-hidden rounded-3xl border p-4 text-left transition ${req.companions === c.id ? 'border-ink bg-ink text-white shadow-lift' : 'border-ink/10 bg-white hover:border-ink/30'}`}>
                  <c.icon className={`mb-3 h-6 w-6 ${req.companions === c.id ? 'text-gold' : 'text-ink'}`} strokeWidth={1.7} />
                  <div className="font-semibold">{c.label}</div>
                  <div className={`text-xs ${req.companions === c.id ? 'text-white/70' : 'text-ink-muted'}`}>{c.note}</div>
                </motion.button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-6">
              {req.companions !== 'solo' && req.companions !== 'couple' && <Stepper label="People" value={req.people} min={2} max={30} onChange={(people) => set({ people })} />}
              {req.companions === 'family' && (
                <>
                  <Toggle on={req.kids} onChange={(kids) => set({ kids })} icon={<Baby className="h-4 w-4" />} label="Small children" />
                  <Toggle on={req.elders} onChange={(elders) => set({ elders })} icon={<User className="h-4 w-4" />} label="Elders" />
                </>
              )}
            </div>
          </Block>

          <Block n={4} title="What's your budget?" hint={basics ? `Food${req.includeStay && req.days > 1 ? ' and stay' : ''} alone come to about ${inr(basics)} for your group.` : undefined}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="h-display text-4xl">{inr(req.budget)} <span className="font-sans text-base text-ink-muted">{req.budgetType === 'per_person' ? 'per person' : 'in total'}</span></div>
              <div className="flex rounded-full bg-white p-1 shadow-soft">
                {(['per_person', 'total'] as const).map((t) => (
                  <button key={t} onClick={() => set({ budgetType: t, budget: t === 'total' ? req.budget * req.people : Math.round(req.budget / req.people / 500) * 500 || 500 })} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${req.budgetType === t ? 'bg-ink text-white' : 'text-ink-soft'}`}>{t === 'per_person' ? 'Per person' : 'Total'}</button>
                ))}
              </div>
            </div>
            <BudgetSlider value={req.budget} onChange={(budget) => { setBudgetTouched(true); set({ budget }); }} max={req.budgetType === 'total' ? 1000000 : 300000} />
            <div className="mt-2 flex justify-between text-xs text-ink-muted"><span>{inr(500)}</span><span>{req.budgetType === 'per_person' && req.people > 1 && `Group total ${inr(budgetTotal)}`}</span><span>{inr(req.budgetType === 'total' ? 1000000 : 300000)}</span></div>
            {!budgetTouched && suggested > 0 && <p className="mt-3 text-xs text-ink-muted">Suggested for {plural(req.days, 'day')} with {plural(req.people, 'person', 'people')}. Move the slider to set your own.</p>}
            {tooLow && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gold-soft px-4 py-3 text-sm">
                <span>{inr(budgetTotal)} won't cover food{req.includeStay && req.days > 1 ? ' and stay' : ''} ({inr(basics)}). About {inr(suggested)} gives you a comfortable trip.</span>
                <button className="btn-ink !px-4 !py-2" onClick={() => { setBudgetTouched(true); set({ budget: asBudget(suggested) }); }}>Use {inr(suggested)}</button>
              </div>
            )}
            {req.days > 1 && <div className="mt-4"><Toggle on={req.includeStay} onChange={(includeStay) => set({ includeStay })} label="Include hotel / homestay in the budget" /></div>}
          </Block>

          <Block n={5} title="What do you love?" hint="Optional — skip it and Raahi picks a balanced mix.">
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const on = req.interests.includes(i);
                return (
                  <motion.button key={i} whileTap={{ scale: 0.92 }} onClick={() => set({ interests: on ? req.interests.filter((x) => x !== i) : [...req.interests, i] })} aria-pressed={on} className={`chip !px-4 !py-2.5 ${on ? 'chip-on' : ''}`}>
                    <span>{INTEREST_ICON[i]}</span> {INTEREST_LABEL[i]}
                  </motion.button>
                );
              })}
            </div>
            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              <div>
                <span className="label">Pace</span>
                <div className="flex rounded-full bg-white p-1 shadow-soft">
                  {(['relaxed', 'balanced', 'packed'] as Pace[]).map((p) => (
                    <button key={p} onClick={() => set({ pace: p })} className="relative flex-1 rounded-full px-3 py-2 text-sm font-semibold capitalize">
                      {req.pace === p && <motion.span layoutId="pace" className="absolute inset-0 rounded-full bg-gold-soft" />}
                      <span className="relative">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">Popular classics ↔ Off-beat gems</span>
                <input type="range" min={0} max={100} step={5} value={req.discovery} onChange={(e) => set({ discovery: Number(e.target.value) })} className="w-full accent-[#C9965B]" aria-label="Popular to off-beat" />
                <div className="flex justify-between text-xs text-ink-muted"><span>Must-sees</span><span>{req.discovery >= 70 ? 'Mostly hidden gems' : req.discovery <= 25 ? 'The famous ones' : 'A good mix'}</span><span>Hidden gems</span></div>
              </div>
            </div>
          </Block>

          <div className="no-print mt-12 hidden md:block">
            <motion.button whileHover={{ scale: ready ? 1.02 : 1 }} whileTap={{ scale: 0.98 }} disabled={!ready} onClick={go} className="btn-ink !px-10 !py-5 text-base shadow-lift">
              <Sparkles className="h-5 w-5 text-gold" /> Show my itinerary
            </motion.button>
            {!ready && <p className="mt-2 text-sm text-ink-muted">Pick a destination to continue.</p>}
          </div>
          {/* phones: a bar that sits above the bottom navigation */}
          <div className="no-print fixed inset-x-0 bottom-24 z-30 px-4 md:hidden">
            <button disabled={!ready} onClick={go} className="btn-ink w-full !py-4 shadow-lift"><Sparkles className="h-5 w-5 text-gold" /> {ready ? 'Show my itinerary' : 'Pick a destination first'}</button>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <div className="card overflow-hidden">
              <div className="relative h-56">
                {dests[0] ? <Photo query={destPhotoQuery(dests[0])} alt={dests[0].name} className="absolute inset-0" kenburns large /> : <div className="absolute inset-0 bg-gradient-to-br from-gold-soft to-sky-soft" />}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <div className="eyebrow !text-white/70">Your trip so far</div>
                  <div className="h-display text-2xl">{dests.length ? dests.map((d) => d.name).join(' → ') : 'Somewhere wonderful'}</div>
                </div>
              </div>
              <dl className="space-y-3 p-5 text-sm">
                <Row k="Dates" v={`${new Date(req.startDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${length === 'hours' ? `${timeSpan(req) / 60 | 0} hours` : plural(req.days, 'day')}`} />
                <Row k="Who" v={`${COMPANIONS.find((c) => c.id === req.companions)?.label}${req.people > 1 ? ` · ${req.people} people` : ''}${req.kids ? ' · kids' : ''}${req.elders ? ' · elders' : ''}`} />
                <Row k="Budget" v={`${inr(budgetTotal)} total`} />
                <Row k="Pace" v={req.pace} />
                {req.interests.length > 0 && <Row k="Loves" v={req.interests.map((i) => INTEREST_LABEL[i]).join(', ')} />}
              </dl>
              <div className="px-5 pb-5">
                <button disabled={!ready} onClick={go} className="btn-ink w-full !py-4"><Sparkles className="h-4 w-4 text-gold" /> Show my itinerary</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Page>
  );
}

const timeSpan = (r: PlanRequest) => {
  const [a, b] = [r.dayStart, r.dayEnd].map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
  return b - a;
};

function Block({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0, margin: '0px 0px 160px 0px' }} transition={{ duration: 0.6 }} className="mt-12 border-t border-ink/10 pt-10">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="h-display text-sm text-gold-deep">0{n}</span>
        <div>
          <h2 className="h-display text-2xl sm:text-3xl">{title}</h2>
          {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-semibold capitalize">{v}</dd></div>;
}

function Stepper({ label, value, min, max, onChange, suffix }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; suffix?: (n: number) => string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-soft">
        <button aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))} className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand-100"><Minus className="h-4 w-4" /></button>
        <motion.span key={value} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="min-w-[72px] text-center font-semibold">{suffix ? suffix(value) : value}</motion.span>
        <button aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))} className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand-100"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const opts = Array.from({ length: 37 }, (_, i) => {
    const m = 5 * 60 + i * 30;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  });
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input !w-40 !rounded-full">
        {opts.map((o) => {
          const h = Number(o.slice(0, 2));
          return <option key={o} value={o}>{`${h % 12 || 12}:${o.slice(3)} ${h >= 12 ? 'PM' : 'AM'}`}</option>;
        })}
      </select>
    </label>
  );
}

function Toggle({ on, onChange, label, icon }: { on: boolean; onChange: (v: boolean) => void; label: string; icon?: ReactNode }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className="flex items-center gap-3 text-sm font-semibold">
      <span className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-ink' : 'bg-ink/15'}`}>
        <motion.span layout className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${on ? 'right-1' : 'left-1'}`} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
      </span>
      {icon}{label}
    </button>
  );
}

/** Budget slider on a curved scale so small budgets get fine control and big ones still fit. */
function BudgetSlider({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  const min = 500;
  const toPos = (v: number) => Math.log(v / min) / Math.log(max / min);
  const fromPos = (p: number) => {
    const raw = min * Math.pow(max / min, p);
    const step = raw < 5000 ? 250 : raw < 50000 ? 500 : raw < 200000 ? 2500 : 10000;
    return Math.round(raw / step) * step;
  };
  return (
    <div className="relative mt-5">
      <div className="h-2 rounded-full bg-sand-200">
        <motion.div className="h-2 rounded-full bg-gradient-to-r from-gold to-terra" style={{ width: `${toPos(value) * 100}%` }} layout />
      </div>
      <input type="range" min={0} max={1000} step={10} value={Math.round(toPos(Math.max(min, Math.min(max, value))) * 1000)} onChange={(e) => onChange(fromPos(Number(e.target.value) / 1000))} className="absolute inset-0 h-2 w-full cursor-pointer opacity-0" aria-label="Budget" />
    </div>
  );
}

function StartPoint({ destId, multi, value, onChange }: { destId: string; multi: boolean; value: PlanRequest['startPoint']; onChange: (v: PlanRequest['startPoint']) => void }) {
  const { data } = useAsync(() => destinationDetail(destId), [destId]);
  if (multi || !data) return null;
  const options = [{ id: 'hub', name: data.destination.hub.name, lat: data.destination.hub.lat, lng: data.destination.hub.lng }, ...data.places.map((p) => ({ id: p.id, name: `Near ${p.name}`, lat: p.lat, lng: p.lng }))];
  const current = value ? options.find((o) => o.lat === value.lat && o.lng === value.lng)?.id ?? 'hub' : 'hub';
  return (
    <label className="mt-5 block max-w-md">
      <span className="label">Where will you stay / start each day?</span>
      <select className="input !rounded-full" value={current} onChange={(e) => {
        const o = options.find((x) => x.id === e.target.value)!;
        onChange(o.id === 'hub' ? null : { name: o.name.replace(/^Near /, ''), lat: o.lat, lng: o.lng });
      }}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.id === 'hub' ? `${o.name} (most hotels)` : o.name}</option>)}
      </select>
    </label>
  );
}
