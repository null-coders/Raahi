import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Calendar, Dices, Filter, Gem, Route, Sparkles, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MONTHS, type DestinationSummary, type DiscoverFeed } from '@raahi/planner';
import { DestinationCard, PlaceCard, destPhotoQuery } from '../components/cards';
import { Footer, Page, TopNav } from '../components/Layout';
import { MustTryCard } from '../components/MustTry';
import { SearchBox } from '../components/SearchBox';
import { Empty, Photo, Reveal, SectionHead } from '../components/ui';
import { api } from '../lib/api';
import { greeting, longDate } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { featuredMustTry } from '../lib/mustTry';

const TYPES = [
  { id: 'all', label: 'All' }, { id: 'mountains', label: '🏔 Mountains' }, { id: 'beach', label: '🏖 Beaches' },
  { id: 'heritage', label: '🏰 Heritage' }, { id: 'spiritual', label: '🪔 Spiritual' }, { id: 'wildlife', label: '🐅 Wildlife' },
  { id: 'snow', label: '❄️ Snow' }, { id: 'lakes', label: '🛶 Lakes' }, { id: 'desert', label: '🐪 Desert' }, { id: 'offbeat', label: '🧭 Off-beat' },
];

export default function Home() {
  const { data, error, loading, reload } = useAsync(() => api.discover(), []);
  const all = useAsync(() => api.destinations(), []);
  return (
    <Page>
      <TopNav />
      <Hero feed={data} />
      {error && <Empty title="We couldn't load destinations" action={<button className="btn-ink" onClick={reload}>Try again</button>}>Check your connection and try again.</Empty>}
      {loading && !data && <RailSkeleton />}
      {data && (
        <>
          <Trending feed={data} />
          <InSeason feed={data} />
          <Gems feed={data} />
        </>
      )}
      <TasteOfIndia names={new Map((all.data ?? []).map((d) => [d.id, d.name]))} />
      {all.data && <Explore list={all.data} />}
      <HowItWorks />
      <Footer />
    </Page>
  );
}

function Hero({ feed }: { feed?: DiscoverFeed }) {
  const nav = useNavigate();
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 15 }), sy = useSpring(my, { stiffness: 60, damping: 15 });
  const rx = useTransform(sy, [-1, 1], [8, -8]), ry = useTransform(sx, [-1, 1], [-10, 10]);
  const cards = feed?.trending.slice(0, 3).map((t) => t.destination) ?? [];
  const surprise = () => {
    const pool = feed?.inSeason.length ? feed.inSeason : feed?.popular ?? [];
    if (pool.length) nav(`/d/${pool[Math.floor(Math.random() * pool.length)].id}`);
  };
  return (
    <section
      className="relative overflow-hidden pt-24 sm:pt-28"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
    >
      {/* soft drifting colour blobs */}
      <motion.div className="pointer-events-none absolute -left-32 top-10 h-[420px] w-[420px] rounded-full bg-gold/25 blur-3xl" animate={{ x: [0, 40, 0], y: [0, 30, 0] }} transition={{ duration: 14, repeat: Infinity }} />
      <motion.div className="pointer-events-none absolute -right-20 top-40 h-[380px] w-[380px] rounded-full bg-sky/30 blur-3xl" animate={{ x: [0, -30, 0], y: [0, 40, 0] }} transition={{ duration: 16, repeat: Infinity }} />
      <div className="wrap relative grid items-center gap-10 pb-16 lg:grid-cols-[1.05fr_1fr] lg:pb-24">
        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-soft">
            <Calendar className="h-3.5 w-3.5 text-gold-deep" /> {greeting()} · {longDate(new Date().toISOString().slice(0, 10))}
          </motion.div>
          <h1 className="h-display text-[44px] leading-[1.02] sm:text-6xl lg:text-7xl">
            <motion.span className="block" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>Where do you</motion.span>
            <motion.span className="block italic text-gold-deep" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}>want to go?</motion.span>
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-soft">
            Tell Raahi your budget, your days and who's coming. It picks the places worth your time, orders them around opening hours and roads, and tells you what it left out and why.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-8 max-w-xl">
            <SearchBox big placeholder="Try Spiti, Udaipur, Varanasi, Goa…" />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-6 flex flex-wrap gap-3">
            <Link to="/plan" className="btn-ink !px-6 !py-3.5"><Sparkles className="h-4 w-4 text-gold" /> Plan my trip</Link>
            <button onClick={surprise} className="btn-ghost !px-6 !py-3.5"><Dices className="h-4 w-4" /> Surprise me</button>
          </motion.div>
        </div>

        {/* 3D floating fan of trending destinations */}
        <div className="relative hidden h-[520px] lg:block" style={{ perspective: 1200 }}>
          <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={{ rotateX: rx, rotateY: ry }}>
            {cards.map((d, i) => (
              <motion.div
                key={d.id}
                className="absolute top-8 w-[260px] animate-float"
                style={{ left: `${8 + i * 26}%`, zIndex: i === 1 ? 3 : 2, animationDelay: `${i * 0.8}s`, transform: `translateZ(${i === 1 ? 80 : 20}px)` }}
                initial={{ opacity: 0, y: 60, rotate: (i - 1) * 9 }}
                animate={{ opacity: 1, y: i === 1 ? 0 : 50, rotate: (i - 1) * 9 }}
                transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 60, damping: 14 }}
              >
                <Link to={`/d/${d.id}`} className="block overflow-hidden rounded-[2rem] border-4 border-white shadow-lift">
                  <div className="relative aspect-[3/4]">
                    <Photo query={destPhotoQuery(d)} alt={d.name} className="absolute inset-0" kenburns credit={false} large />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <div className="text-[11px] text-white/70">{d.state}</div>
                      <div className="h-display text-2xl">{d.name}</div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            {!cards.length && [0, 1, 2].map((i) => <div key={i} className="skeleton absolute top-10 aspect-[3/4] w-[260px] rounded-[2rem]" style={{ left: `${8 + i * 26}%`, transform: `rotate(${(i - 1) * 9}deg)` }} />)}
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1 }} className="glass absolute bottom-10 left-6 flex items-center gap-3 rounded-3xl px-4 py-3 shadow-soft">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-terra text-white"><Gem className="h-5 w-5" /></span>
            <div><div className="text-sm font-semibold">100+ destinations</div><div className="text-xs text-ink-muted">700 places worth your time</div></div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/** A taste of what each place is known for: the bite or the moment, not just the sight. */
function TasteOfIndia({ names }: { names: Map<string, string> }) {
  const { data } = useAsync(() => featuredMustTry(), []);
  if (!data?.length) return null;
  return (
    <section className="wrap mt-24">
      <Reveal><SectionHead eyebrow="Taste & try" title={<>A taste of <span className="italic text-gold-deep">India</span></>} sub="The dish, the drink and the moment each place is known for. Open any card to see everything worth trying there." /></Reveal>
      <div className="snap-row -mx-4 px-4">
        {data.map((it, i) => (
          <div key={it.id} className="w-[78%] shrink-0 snap-start sm:w-[300px]">
            <MustTryCard item={it} link index={i} from={names.get(it.destId)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Trending({ feed }: { feed: DiscoverFeed }) {
  return (
    <section className="wrap mt-4">
      <Reveal><SectionHead eyebrow="Rising right now" title={<>Trending <span className="italic text-gold-deep">this season</span></>} sub="What travellers are planning, festivals coming up and places entering their best weeks — each with the reason it's here." /></Reveal>
      <div className="snap-row -mx-4 px-4">
        {feed.trending.map((t, i) => (
          <Reveal key={t.destinationId} delay={i * 0.05} className="w-[72%] shrink-0 sm:w-[300px]">
            <DestinationCard d={t.destination} reason={t.reason} rank={i + 1} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function InSeason({ feed }: { feed: DiscoverFeed }) {
  const [hero, ...rest] = feed.inSeason;
  if (!hero) return null;
  return (
    <section className="wrap mt-20">
      <Reveal><SectionHead eyebrow={`Best in ${MONTHS[feed.month - 1]}`} title={<>In season <span className="italic text-gold-deep">now</span></>} /></Reveal>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <Link to={`/d/${hero.id}`} className="group relative block h-[420px] overflow-hidden rounded-5xl shadow-soft">
            <Photo query={destPhotoQuery(hero)} alt={hero.name} className="absolute inset-0" kenburns large />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
            <div className="absolute bottom-0 p-8 text-white">
              <span className="pill mb-3 bg-gold text-ink">Perfect month to go</span>
              <div className="h-display text-4xl sm:text-5xl">{hero.name}</div>
              <p className="mt-2 max-w-md text-white/85">{hero.tagline}</p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition group-hover:gap-3">Explore <ArrowRight className="h-4 w-4" /></span>
            </div>
          </Link>
        </Reveal>
        <div className="grid grid-cols-2 gap-5">
          {rest.slice(0, 4).map((d, i) => (
            <Reveal key={d.id} delay={i * 0.06}><DestinationCard d={d} tall={false} /></Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gems({ feed }: { feed: DiscoverFeed }) {
  return (
    <section className="mt-24 bg-ink py-20 text-white">
      <div className="wrap">
        <Reveal>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-2 !text-gold">Loved by those who go, known by few</div>
              <h2 className="h-display text-4xl sm:text-5xl">Hidden <span className="italic text-gold">gems</span></h2>
              <p className="mt-3 max-w-xl text-white/70">Raahi scores every place for quality and for how crowded it is. These are the high-quality, low-crowd ones — slide the Off-beat dial when planning to get more of them.</p>
            </div>
          </div>
        </Reveal>
        <div className="snap-row -mx-4 px-4">
          {feed.gems.map((g, i) => (
            <Reveal key={g.id} delay={i * 0.04} className="w-[78%] shrink-0 text-ink sm:w-[300px]">
              <PlaceCard p={{ ...g, gem: true }} destName={g.destinationName} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Explore({ list }: { list: DestinationSummary[] }) {
  const [type, setType] = useState('all');
  const [region, setRegion] = useState('All');
  const [limit, setLimit] = useState(12);
  const regions = useMemo(() => ['All', ...new Set(list.map((d) => d.region))], [list]);
  const shown = list
    .filter((d) => (type === 'all' || d.types.includes(type)) && (region === 'All' || d.region === region))
    .sort((a, b) => b.popularity - a.popularity);
  return (
    <section id="explore" className="wrap mt-24">
      <Reveal><SectionHead eyebrow="All of India" title={<>Explore <span className="italic text-gold-deep">{list.length} destinations</span></>} /></Reveal>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)} className={`chip shrink-0 ${type === t.id ? 'chip-on' : ''}`}>{t.label}</button>
        ))}
      </div>
      <div className="mb-8 flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-soft no-scrollbar sm:inline-flex">
        {regions.map((r) => (
          <button key={r} onClick={() => setRegion(r)} className="relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold">
            {region === r && <motion.span layoutId="region-pill" className="absolute inset-0 rounded-full bg-gold-soft" />}
            <span className="relative">{r}</span>
          </button>
        ))}
      </div>
      <motion.div layout className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {shown.slice(0, limit).map((d) => (
          <motion.div key={d.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <DestinationCard d={d} />
          </motion.div>
        ))}
      </motion.div>
      {shown.length > limit && (
        <div className="mt-8 text-center"><button className="btn-ghost !px-8" onClick={() => setLimit((l) => l + 24)}>Show more destinations ({shown.length - limit} left)</button></div>
      )}
      {!shown.length && <Empty icon={Filter} title="No destinations match">Try another type or region.</Empty>}
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Wallet, title: 'You tell us', text: 'Budget, days, who’s coming and what you love.' },
    { icon: Filter, title: 'We narrow it down', text: 'Closed, out of season or unreachable places drop out — with the reason.' },
    { icon: Sparkles, title: 'We pick the best set', text: 'A knapsack algorithm weighs every combination against your money and time.' },
    { icon: Route, title: 'We plan the route', text: 'Shortest paths, days grouped by area, stops ordered around opening hours.' },
  ];
  return (
    <section className="wrap mt-24">
      <Reveal><SectionHead eyebrow="Honest, not just optimistic" title={<>How Raahi <span className="italic text-gold-deep">decides</span></>} /></Reveal>
      <div className="relative grid gap-6 md:grid-cols-4">
        <motion.div className="absolute left-0 right-0 top-8 hidden h-0.5 origin-left bg-gradient-to-r from-gold via-terra to-ink md:block" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: 'easeOut' }} />
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={0.15 * i}>
            <div className="relative">
              <div className="relative z-10 mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-white shadow-soft"><s.icon className="h-7 w-7 text-gold-deep" strokeWidth={1.6} /></div>
              <div className="h-display text-xl">{s.title}</div>
              <p className="mt-1 text-sm text-ink-soft">{s.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function RailSkeleton() {
  return (
    <div className="wrap mt-6">
      <div className="skeleton mb-6 h-10 w-64 rounded-full" />
      <div className="flex gap-4 overflow-hidden">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton aspect-[3/4] w-[280px] shrink-0 rounded-4xl" />)}</div>
    </div>
  );
}
