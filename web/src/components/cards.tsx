import { motion } from 'framer-motion';
import { Clock, IndianRupee, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DestinationSummary, Place } from '@raahi/planner';
import { CATEGORY_LABEL, duration, inr, monthRanges } from '../lib/format';
import { GemBadge, Photo, Tilt } from './ui';

export function destPhotoQuery(d: { id: string; wiki?: string; photoQuery?: string; name: string; state: string }, count = 1) {
  return { id: `dest:${d.id}`, title: d.wiki, q: d.photoQuery ?? `${d.name} ${d.state}`, count, gallery: count > 1 };
}
export function placePhotoQuery(p: { id: string; wiki?: string; photoQuery?: string; name: string }, destName = '', count = 1) {
  return { id: `place:${p.id}`, title: p.wiki, q: p.photoQuery ?? `${p.name} ${destName}`.trim(), count };
}

/** Big portrait photo card with the destination name over a soft gradient. */
export function DestinationCard({ d, reason, rank, tall = true }: { d: DestinationSummary; reason?: string; rank?: number; tall?: boolean }) {
  return (
    <Link to={`/d/${d.id}`} className="block snap-start">
      <Tilt className="rounded-4xl">
        <div className={`relative overflow-hidden rounded-4xl shadow-soft ${tall ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}>
          <Photo query={destPhotoQuery(d)} alt={d.name} className="absolute inset-0" imgClassName="transition-transform duration-[1.2s] group-hover/photo:scale-110" credit={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
          {rank !== undefined && (
            <div className="absolute left-4 top-4 h-display text-5xl font-semibold text-white/90 drop-shadow [transform:translateZ(40px)]">{rank}</div>
          )}
          {reason && (
            <div className="absolute right-3 top-3 [transform:translateZ(30px)]">
              <span className="pill glass text-ink"><TrendingUp className="h-3 w-3 text-terra" /> {reason}</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-5 text-white [transform:translateZ(50px)]">
            <div className="text-xs font-medium text-white/75">{d.state}</div>
            <div className="h-display text-2xl leading-tight sm:text-[28px]">{d.name}</div>
            <div className="mt-1 line-clamp-2 text-[13px] text-white/80">{d.tagline}</div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className="pill bg-white/20 text-white backdrop-blur">{d.idealDays[0] === d.idealDays[1] ? `${d.idealDays[0]} day${d.idealDays[0] > 1 ? 's' : ''}` : `${d.idealDays[0]}–${d.idealDays[1]} days`}</span>
              <span className="pill bg-white/20 text-white backdrop-blur">Best {monthRanges(d.bestMonths)}</span>
              {d.gemCount > 0 && <span className="pill bg-gold/90 text-ink"><Sparkles className="h-3 w-3" /> {d.gemCount} gems</span>}
            </div>
          </div>
        </div>
      </Tilt>
    </Link>
  );
}

export function PlaceCard({ p, destName, onClick }: { p: Place & { gem?: boolean }; destName?: string; onClick?: () => void }) {
  const body = (
    <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} className="card group overflow-hidden">
      <div className="relative aspect-[4/3]">
        <Photo query={placePhotoQuery(p, destName)} alt={p.name} icon={p.category} className="absolute inset-0" imgClassName="transition-transform duration-[1.2s] group-hover:scale-110" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="pill glass text-ink">{CATEGORY_LABEL[p.category] ?? p.category}</span>
        </div>
        {p.gem && <div className="absolute right-3 top-3"><GemBadge small /></div>}
      </div>
      <div className="p-4">
        {destName && <div className="mb-1 flex items-center gap-1 text-xs text-ink-muted"><MapPin className="h-3 w-3" />{destName}</div>}
        <div className="h-display text-lg leading-snug">{p.name}</div>
        <p className="mt-1 line-clamp-2 text-[13px] text-ink-soft">{p.description}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{duration(p.visitMins)}</span>
          <span className="inline-flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" />{p.fee ? inr(p.fee).slice(1) : 'Free'}</span>
        </div>
      </div>
    </motion.div>
  );
  return onClick ? <button className="block w-full text-left" onClick={onClick}>{body}</button> : <Link to={`/p/${p.id}`} className="block">{body}</Link>;
}
