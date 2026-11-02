import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, CalendarDays, MapPin, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Footer, Page, TopNav } from '../components/Layout';
import { Empty, Photo, Tilt } from '../components/ui';
import { dayLabel, inr, plural } from '../lib/format';
import { removeTrip, savedTrips, tripUrl } from '../lib/request';

export default function Saved() {
  const [trips, setTrips] = useState(savedTrips);
  return (
    <Page>
      <TopNav />
      <div className="wrap pt-28">
        <h1 className="h-display text-5xl sm:text-6xl">Saved <span className="italic text-gold-deep">trips</span></h1>
        <p className="mt-3 text-lg text-ink-soft">Kept on this device. Open one to see the latest plan, or share its link.</p>
        {!trips.length && <Empty icon={Bookmark} title="Nothing saved yet" action={<Link className="btn-ink" to="/plan">Plan a trip</Link>}>Save an itinerary and it will wait for you here.</Empty>}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {trips.map((t) => {
              const [from, to] = t.dates.split('|');
              return (
                <motion.div key={t.key} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <Tilt className="rounded-4xl">
                    <div className="card overflow-hidden">
                      <Link to={tripUrl(t.request)} className="relative block h-48">
                        <Photo query={{ id: `dest:${t.destinationIds[0]}`, q: t.title.replace(/^.* in /, ''), count: 1 }} alt={t.title} className="absolute inset-0" credit={false} />
                        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                        <div className="absolute bottom-4 left-5 right-5 text-white"><div className="h-display text-2xl leading-tight">{t.title}</div></div>
                      </Link>
                      <div className="flex items-center justify-between p-5 text-sm">
                        <div className="space-y-1 text-ink-soft">
                          <div className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{dayLabel(from)}{from !== to ? ` – ${dayLabel(to)}` : ''}</div>
                          <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{plural(t.places, 'place')} · {inr(t.total)}</div>
                        </div>
                        <button aria-label="Delete saved trip" onClick={() => { removeTrip(t.key); setTrips(savedTrips()); }} className="rounded-full bg-sand-100 p-2.5 hover:bg-terra-soft"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </Tilt>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      <Footer />
    </Page>
  );
}
