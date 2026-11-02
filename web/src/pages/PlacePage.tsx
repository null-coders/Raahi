import { motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Clock, Flag, IndianRupee, Lightbulb, MapPin, Navigation, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DAYS } from '@raahi/planner';
import { placePhotoQuery } from '../components/cards';
import { Footer, Page, TopNav } from '../components/Layout';
import { MapView, gmapsPlace } from '../components/MapView';
import { Empty, GemBadge, Photo, Reveal, Stat, Tilt } from '../components/ui';
import { api } from '../lib/api';
import { CATEGORY_LABEL, duration, inr, monthRanges } from '../lib/format';
import { useAsync, usePhotos } from '../lib/hooks';

export default function PlacePage() {
  const { id = '' } = useParams();
  const { data, error, loading } = useAsync(() => api.place(id), [id]);
  const { list } = usePhotos(data ? placePhotoQuery(data.place, data.destination.name, 4) : null);
  const [reported, setReported] = useState(false);
  if (error) return <Page><TopNav /><div className="pt-28"><Empty title="We couldn't find that place" action={<Link to="/" className="btn-ink">Back to discover</Link>} /></div></Page>;
  if (loading || !data) return <Page><TopNav /><div className="wrap pt-28"><div className="skeleton h-[420px] rounded-5xl" /></div></Page>;
  const { place: p, destination: d, nearby } = data;
  const hours = p.open === '24h' ? 'Open all day' : p.open.replace('-', ' – ');
  return (
    <Page>
      <TopNav />
      <div className="wrap pt-24 sm:pt-28">
        <Link to={`/d/${d.id}`} className="btn-ghost mb-6"><ArrowLeft className="h-4 w-4" /> {d.name}</Link>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative h-[420px] overflow-hidden rounded-5xl shadow-soft sm:h-[520px]">
            <Photo photo={list[0]} query={list.length ? null : placePhotoQuery(p, d.name)} alt={p.name} icon={p.category} className="absolute inset-0" kenburns large />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
            <div className="absolute bottom-0 p-6 text-white sm:p-10">
              <div className="mb-3 flex flex-wrap gap-2"><span className="pill glass text-ink">{CATEGORY_LABEL[p.category]}</span>{p.gem && <GemBadge />}</div>
              <h1 className="h-display text-4xl leading-tight sm:text-6xl">{p.name}</h1>
              <div className="mt-2 flex items-center gap-1.5 text-white/80"><MapPin className="h-4 w-4" />{d.name}, {d.state}</div>
            </div>
          </motion.div>
          <div className="hidden grid-rows-3 gap-4 lg:grid">
            {list.slice(1, 4).map((ph, i) => (
              <motion.div key={ph.url} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}>
                <Tilt className="h-full rounded-4xl"><Photo photo={ph} alt={`${p.name} ${i + 2}`} className="h-full rounded-4xl shadow-soft" /></Tilt>
              </motion.div>
            ))}
            {list.length < 2 && <div className="row-span-3 rounded-4xl bg-gradient-to-br from-gold-soft to-sky-soft" />}
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Reveal>
              <div className="card grid grid-cols-2 gap-5 p-6">
                <Stat icon={Clock} label="Hours" value={hours} sub={p.closedDays.length ? `Closed ${p.closedDays.map((x) => DAYS[x]).join(', ')}` : undefined} />
                <Stat icon={IndianRupee} label="Entry" value={p.fee ? `${inr(p.fee)}` : 'Free'} sub="Indian adult, approx." />
                <Stat icon={Sparkles} label="Time needed" value={duration(p.visitMins)} />
                <Stat icon={CalendarDays} label="Open months" value={p.months ? monthRanges(p.months) : 'All year'} sub={`Best trip months: ${monthRanges(d.bestMonths)}`} />
              </div>
            </Reveal>
            <Reveal delay={0.05}><p className="h-display mt-8 text-2xl leading-snug">{p.description}</p></Reveal>
            {p.tip && <Reveal delay={0.1}><div className="mt-6 flex gap-3 rounded-3xl bg-gold-soft p-5"><Lightbulb className="h-5 w-5 shrink-0 text-gold-deep" /><div><div className="font-semibold">Local tip</div><p className="text-ink-soft">{p.tip}</p></div></div></Reveal>}
            {(p.avoidKids || p.avoidElders) && (
              <div className="mt-4 rounded-3xl bg-terra-soft p-4 text-sm">{p.avoidElders ? 'Involves a steep climb or long walk. ' : ''}{p.avoidKids ? 'Not ideal with small children.' : ''}</div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={`/plan?dest=${d.id}&must=${p.id}`} className="btn-ink"><Plus className="h-4 w-4" /> Plan a trip with this</Link>
              <a href={gmapsPlace(p)} target="_blank" rel="noreferrer" className="btn-ghost"><Navigation className="h-4 w-4" /> Open in Google Maps</a>
              <button disabled={reported} onClick={() => api.report(p.id, 'outdated', '').then(() => setReported(true))} className="btn-ghost"><Flag className="h-4 w-4" /> {reported ? 'Thanks — we’ll check it' : 'Something’s wrong?'}</button>
            </div>
          </div>
          <div>
            <Reveal><MapView className="h-72 rounded-4xl shadow-soft" points={[{ id: p.id, lat: p.lat, lng: p.lng, title: p.name, label: '★', color: '#D9653B' }]} interactive={false} /></Reveal>
            {nearby.length > 0 && (
              <Reveal delay={0.1}>
                <div className="mt-8">
                  <div className="eyebrow mb-1">Nearby</div>
                  <h3 className="h-display mb-4 text-2xl">Combine it with</h3>
                  <div className="space-y-3">
                    {nearby.map(({ place: n, km }) => (
                      <Link key={n.id} to={`/p/${n.id}`} className="card flex items-center gap-3 p-3 transition hover:shadow-lift">
                        <Photo query={placePhotoQuery(n, d.name)} alt={n.name} icon={n.category} className="h-16 w-16 shrink-0 rounded-2xl" credit={false} />
                        <div className="min-w-0"><div className="truncate font-semibold">{n.name}</div><div className="text-xs text-ink-muted">{CATEGORY_LABEL[n.category]} · about {km} km away</div></div>
                      </Link>
                    ))}
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        </div>
        <section className="mt-20">
          <div className="eyebrow mb-2">Life & traditions</div>
          <h2 className="h-display mb-4 text-3xl">Around {d.name}</h2>
          <p className="max-w-3xl text-ink-soft">See the people, food and festivals of {d.name} on its destination page.</p>
          <Link to={`/d/${d.id}`} className="btn-sand mt-4">Explore {d.name}</Link>
        </section>
      </div>
      <Footer />
    </Page>
  );
}
