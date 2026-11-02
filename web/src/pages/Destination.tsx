import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, CalendarDays, Clock3, IndianRupee, Languages, MapPin, Mountain, PartyPopper, RefreshCw, Sparkles, Train, Utensils } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MONTHS, type Destination as Dest } from '@raahi/planner';
import { PlaceCard, destPhotoQuery } from '../components/cards';
import { Footer, Page, TopNav } from '../components/Layout';
import { MapView } from '../components/MapView';
import { MustTrySection } from '../components/MustTry';
import { Empty, Photo, Reveal, SectionHead, Stat, Tilt } from '../components/ui';
import { api } from '../lib/api';
import { updatedLabel, useLiveWeather } from '../lib/useLiveWeather';
import { CATEGORY_LABEL, dayLabel, inr, monthRanges, weatherOf } from '../lib/format';
import { useAsync, useCycle, usePhotos } from '../lib/hooks';
import { mustTryFor } from '../lib/mustTry';
import { defaultRequest, tripUrl } from '../lib/request';

export default function DestinationPage() {
  const { id = '' } = useParams();
  const { data, error, loading } = useAsync(() => api.destination(id), [id]);
  if (error) return <Page><TopNav /><div className="pt-28"><Empty title="We couldn't find that destination" action={<Link to="/" className="btn-ink">Back to discover</Link>} /></div></Page>;
  if (loading || !data) return <Page><TopNav overHero /><div className="skeleton h-[78vh] w-full" /></Page>;
  const { destination: d, places } = data;
  return (
    <Page>
      <TopNav overHero />
      <Hero d={d} />
      <QuickFacts d={d} />
      <div className="wrap mt-16 grid gap-12 lg:grid-cols-[1.35fr_1fr]">
        <Reveal>
          <div className="eyebrow mb-3">About</div>
          <p className="h-display text-2xl leading-snug sm:text-[28px]">{d.about}</p>
        </Reveal>
        <Reveal delay={0.1}><WeatherCard d={d} /></Reveal>
      </div>
      <LifeHere d={d} />
      <MustTry d={d} />
      <Places d={d} places={places} />
      <section className="wrap mt-20">
        <Reveal><SectionHead eyebrow="Where everything is" title="On the map" /></Reveal>
        <Reveal>
          <MapView
            className="h-[420px] rounded-5xl shadow-soft"
            hub={d.hub}
            points={places.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.name, label: String(i + 1), color: p.gem ? '#C9965B' : '#16233F', href: `/p/${p.id}`, sub: CATEGORY_LABEL[p.category] }))}
          />
        </Reveal>
        <p className="mt-4 flex items-start gap-2 text-sm text-ink-soft"><Train className="mt-0.5 h-4 w-4 shrink-0" /> <span><b>Getting there:</b> {d.gettingThere}</span></p>
      </section>
      <PlanCta d={d} />
      <Footer />
    </Page>
  );
}

function MustTry({ d }: { d: Dest }) {
  const { data } = useAsync(() => mustTryFor(d.id), [d.id]);
  // arriving from a card on the home page: scroll to the section once it has rendered
  useEffect(() => {
    if (data?.length && window.location.hash === '#must-try') setTimeout(() => document.getElementById('must-try')?.scrollIntoView({ behavior: 'smooth' }), 350);
  }, [data?.length]);
  return <MustTrySection name={d.name} items={data ?? []} />;
}

function Hero({ d }: { d: Dest }) {
  const { list } = usePhotos(destPhotoQuery(d, 8));
  const i = useCycle(Math.min(list.length, 6), 6500);
  // warm the next slide so the crossfade never shows an empty frame
  useEffect(() => { const n = Math.min(list.length, 6); if (n > 1) new Image().src = list[(i + 1) % n].url; }, [i, list]);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <>
      <section ref={ref} className="relative h-[78vh] min-h-[520px] overflow-hidden bg-ink">
        <motion.div style={{ y }} className="absolute inset-0">
          <AnimatePresence mode="sync">
            <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6 }}>
              <Photo photo={list[i]} query={list.length ? null : destPhotoQuery(d)} alt={d.name} className="h-full w-full" kenburns large />
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/40" />
        <motion.div style={{ opacity: fade }} className="wrap relative flex h-full flex-col justify-end pb-14 text-white">
          <Link to="/" className="no-print mb-auto mt-24 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur hover:bg-white/25"><ArrowLeft className="h-4 w-4" /> Discover</Link>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
            <div className="mb-3 flex items-center gap-2 text-sm text-white/80"><MapPin className="h-4 w-4" /> {d.state} · {d.region}</div>
            <h1 className="h-display text-5xl leading-none sm:text-7xl lg:text-8xl">{d.name}</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/85 sm:text-xl">{d.tagline}</p>
          </motion.div>
          {list.length > 1 && (
            <div className="mt-8 flex gap-1.5">{list.slice(0, 6).map((_, k) => <span key={k} className={`h-1 rounded-full transition-all duration-700 ${k === i ? 'w-10 bg-gold' : 'w-4 bg-white/40'}`} />)}</div>
          )}
        </motion.div>
      </section>
      {list.length > 2 && (
        <div className="wrap -mt-10 relative z-10">
          <div className="snap-row">
            {list.map((p, k) => (
              <motion.div key={p.url} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + k * 0.06 }} className="shrink-0 snap-start">
                <Tilt className="rounded-3xl"><Photo photo={p} alt={`${d.name} photo ${k + 1}`} className="h-44 w-64 rounded-3xl border-4 border-white shadow-lift sm:h-52 sm:w-80" /></Tilt>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function QuickFacts({ d }: { d: Dest }) {
  const perDay = d.foodPerDay + d.stayPerNight / 2;
  return (
    <div className="wrap mt-8">
      <Reveal>
        <div className="card grid grid-cols-2 gap-6 p-6 sm:grid-cols-3 lg:grid-cols-5">
          <Stat icon={CalendarDays} label="Best time" value={monthRanges(d.bestMonths)} />
          <Stat icon={Clock3} label="Ideal stay" value={d.idealDays[0] === d.idealDays[1] ? `${d.idealDays[0]} day${d.idealDays[0] > 1 ? 's' : ''}` : `${d.idealDays[0]}–${d.idealDays[1]} days`} />
          <Stat icon={IndianRupee} label="Daily spend" value={`≈ ${inr(perDay)}`} sub="per person, food + stay" />
          {d.altitude ? <Stat icon={Mountain} label="Altitude" value={`${d.altitude.toLocaleString('en-IN')} m`} /> : <Stat icon={MapPin} label="Region" value={d.region} />}
          <Stat icon={Languages} label="Language" value={d.language} />
        </div>
      </Reveal>
    </div>
  );
}

function WeatherCard({ d }: { d: Dest }) {
  const { data, error, loading, refresh } = useLiveWeather(d.lat, d.lng, 6);
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 60000); return () => window.clearInterval(t); }, []);
  const c = data?.current;
  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-sky-soft to-white p-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="eyebrow">Weather now</div>
          <button type="button" onClick={refresh} disabled={loading} title="Refresh weather"
            className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-ink-muted transition hover:text-ink disabled:opacity-70">
            <span className={`h-1.5 w-1.5 rounded-full ${error && !data ? 'bg-terra' : 'bg-emerald-500'} ${loading ? 'animate-pulse' : ''}`} />
            {error && !data ? 'Weather unavailable · retry' : data ? `Live · ${updatedLabel(data.fetchedAt)}` : 'Loading…'}
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {c ? (
          <div className="flex items-center gap-3">
            <span className="text-5xl">{!c.isDay && c.code <= 1 ? '🌙' : weatherOf(c.code).icon}</span>
            <div>
              <div className="h-display text-4xl">{c.temp}°C</div>
              <div className="text-sm text-ink-soft">{weatherOf(c.code).label} · feels {c.feels}°</div>
              <div className="mt-0.5 text-xs text-ink-muted">Humidity {c.humidity}% · Wind {c.wind} km/h</div>
            </div>
          </div>
        ) : error ? <p className="mt-2 text-sm text-ink-soft">Couldn't reach the weather service. Check your connection and tap retry.</p>
          : <div className="skeleton mt-2 h-12 w-40 rounded-xl" />}
      </div>
      <div className="grid grid-cols-6 gap-1 p-4">
        {(data?.daily ?? []).map((w) => (
          <div key={w.date} className="rounded-2xl py-2 text-center">
            <div className="text-[11px] font-semibold text-ink-muted">{dayLabel(w.date).split(',')[0]}</div>
            <div className="my-1 text-xl">{weatherOf(w.code).icon}</div>
            <div className="text-xs font-semibold">{w.max}°<span className="text-ink-muted"> {w.min}°</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The people, their homes, food and festivals — what makes a place feel lived in. */
function LifeHere({ d }: { d: Dest }) {
  const people = { id: `life:${d.id}:0`, q: `${d.name} ${d.state} people traditional`, count: 1 };
  const fest = { id: `life:${d.id}:1`, q: d.festivals[0]?.name ? `${d.festivals[0].name.split(/[,(/]/)[0]} ${d.state}` : `${d.name} village`, count: 1 };
  const food = { id: `life:${d.id}:2`, q: d.dishes[0]?.replace(/\(.*?\)/g, '').trim() ?? `${d.name} food`, count: 1 };
  // the food card shows this place's own signature dish (from the must-try list), not a generic plate
  const { data: tries } = useAsync(() => mustTryFor(d.id), [d.id]);
  const dish = tries?.find((t) => !t.isExperience && t.photo);
  const captions = ['Life in ' + d.name, 'Around ' + d.name, dish?.name ?? 'Local food'];
  return (
    <section className="mt-24 bg-sand-50 py-20">
      <div className="wrap grid items-center gap-12 lg:grid-cols-2">
        <div className="relative h-[460px]" style={{ perspective: 1000 }}>
          {[people, fest, food].map((q, k) => (
            <motion.div
              key={k}
              className="absolute w-[58%] overflow-hidden rounded-4xl border-[6px] border-white shadow-lift"
              style={{ left: ['0%', '40%', '18%'][k], top: ['2%', '12%', '48%'][k], zIndex: [1, 2, 3][k] }}
              initial={{ opacity: 0, y: 40, rotate: [-6, 5, -2][k] }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.04, rotate: 0, zIndex: 5 }}
              transition={{ delay: k * 0.15, type: 'spring', stiffness: 80, damping: 14 }}
            >
              {k === 2 && dish?.photo
                ? <Photo photo={dish.photo} alt={dish.name} className="aspect-[4/3]" />
                : <Photo query={q} alt={['People of ' + d.name, 'Festival', 'Food'][k]} className="aspect-[4/3]" />}
              <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink shadow-soft">{captions[k]}</div>
            </motion.div>
          ))}
        </div>
        <div>
          <Reveal>
            <div className="eyebrow mb-3">Life here</div>
            <h2 className="h-display text-4xl">The people of <span className="italic text-gold-deep">{d.name}</span></h2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">{d.people}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Utensils className="h-4 w-4 text-terra" /> Taste this <a href="#must-try" className="ml-1 text-xs font-semibold text-gold-deep hover:underline">See the full must-try list ↓</a></div>
              <div className="flex flex-wrap gap-2">{d.dishes.map((x) => <span key={x} className="chip !bg-white">{x}</span>)}</div>
            </div>
          </Reveal>
          {d.festivals.length > 0 && (
            <Reveal delay={0.2}>
              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><PartyPopper className="h-4 w-4 text-gold-deep" /> Festivals</div>
                <div className="flex flex-wrap gap-2">{d.festivals.map((f) => <span key={f.name} className="chip !bg-white">{f.name} <span className="text-ink-muted">· {MONTHS[f.month - 1]}</span></span>)}</div>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

function Places({ d, places }: { d: Dest; places: (import('@raahi/planner').Place & { gem: boolean })[] }) {
  const cats = useMemo(() => ['all', ...new Set(places.map((p) => p.category))], [places]);
  const [cat, setCat] = useState('all');
  const shown = places.filter((p) => cat === 'all' || p.category === cat);
  return (
    <section className="wrap mt-20">
      <Reveal><SectionHead eyebrow={`${places.length} places worth your time`} title={<>What to see in <span className="italic text-gold-deep">{d.name}</span></>} /></Reveal>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 ${cat === c ? 'chip-on' : ''}`}>{c === 'all' ? 'All' : CATEGORY_LABEL[c] ?? c}</button>)}
      </div>
      <motion.div layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => (
          <motion.div key={p.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
            <PlaceCard p={p} destName={d.name} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function PlanCta({ d }: { d: Dest }) {
  const quick = { ...defaultRequest([d.id]), days: d.idealDays[0] };
  return (
    <>
      <section className="wrap mt-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-5xl bg-ink p-10 text-white sm:p-14">
            <motion.div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/30 blur-3xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity }} />
            <div className="relative max-w-2xl">
              <h2 className="h-display text-4xl sm:text-5xl">Ready for <span className="italic text-gold">{d.name}</span>?</h2>
              <p className="mt-3 text-white/75">Tell us your budget, days and company — we'll build an itinerary that actually fits.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to={`/plan?dest=${d.id}`} className="btn-gold !px-6 !py-3.5"><Sparkles className="h-4 w-4" /> Plan my trip</Link>
                <Link to={tripUrl(quick)} className="btn bg-white/10 text-white hover:bg-white/20">Quick {quick.days}-day plan for 2</Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
      <div className="no-print fixed inset-x-0 bottom-24 z-30 px-4 md:hidden">
        <Link to={`/plan?dest=${d.id}`} className="btn-gold w-full !py-4 shadow-lift"><Sparkles className="h-4 w-4" /> Plan a trip to {d.name}</Link>
      </div>
    </>
  );
}
