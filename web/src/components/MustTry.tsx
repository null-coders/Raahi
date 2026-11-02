import { Coffee, Compass, Cookie, MapPin, Soup, Sparkles, Utensils, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MustTry } from '../lib/mustTry';
import { inr } from '../lib/format';
import { Photo, Reveal, SectionHead, Tilt } from './ui';

const KIND_ICON: Record<string, LucideIcon> = {
  'Street food': Utensils, Dish: Soup, Breakfast: Coffee, Drink: Coffee, Sweet: Cookie, 'Local special': Sparkles, Experience: Compass,
};
const KIND_TINT: Record<string, string> = {
  Experience: 'bg-sky text-ink', Drink: 'bg-gold-soft text-gold-deep', Sweet: 'bg-terra-soft text-terra',
};

const priceLabel = (p: number) => (p === 0 ? 'Free' : `About ${inr(p)}`);

/** One tasty card: photo, what it is, where to get it, roughly what it costs. */
export function MustTryCard({ item, link, index = 0, from }: { item: MustTry; link?: boolean; index?: number; from?: string }) {
  const Icon = KIND_ICON[item.kind] ?? Utensils;
  const body = (
    <Tilt max={4} className="h-full rounded-4xl">
      <div className="card flex h-full flex-col overflow-hidden !rounded-4xl">
        <div className="relative aspect-[4/3] w-full">
          <Photo photo={item.photo} alt={item.name} className="absolute inset-0" imgClassName="transition-transform duration-[1.2s] group-hover/photo:scale-105" />
          {!item.photo && <div className="absolute inset-0 grid place-items-center text-white/80"><Icon className="h-12 w-12" strokeWidth={1.2} /></div>}
          <span className={`pill absolute left-3 top-3 shadow-soft ${KIND_TINT[item.kind] ?? 'bg-white text-ink'}`}><Icon className="h-3 w-3" /> {item.kind}</span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          {from && <div className="eyebrow mb-1">{from}</div>}
          <h3 className="h-display text-[22px] leading-tight">{item.name}</h3>
          <p className="mt-2 flex-1 text-[14px] leading-relaxed text-ink-soft">{item.desc}</p>
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-sand-100 pt-3 text-xs text-ink-muted">
            <span className="flex min-w-0 items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terra" /><span className="line-clamp-2">{item.where}</span></span>
            <span className="shrink-0 rounded-full bg-sand-50 px-2.5 py-1 font-semibold text-ink">{priceLabel(item.price)}</span>
          </div>
        </div>
      </div>
    </Tilt>
  );
  return (
    <Reveal delay={Math.min(index, 5) * 0.06} className="group h-full">
      {link ? <Link to={`/d/${item.destId}#must-try`} className="block h-full">{body}</Link> : body}
    </Reveal>
  );
}

type Tab = 'all' | 'eat' | 'do';

/** The "Must try in X" section of a destination page. */
export function MustTrySection({ name, items }: { name: string; items: MustTry[] }) {
  const [tab, setTab] = useState<Tab>('all');
  if (!items.length) return null;
  const eat = items.filter((i) => !i.isExperience);
  const doIt = items.filter((i) => i.isExperience);
  const shown = tab === 'eat' ? eat : tab === 'do' ? doIt : items;
  const tabs: [Tab, string, number][] = [['all', 'Everything', items.length], ['eat', 'Eat & drink', eat.length], ['do', 'Do & see', doIt.length]];
  return (
    <section id="must-try" className="wrap mt-24 scroll-mt-24">
      <Reveal>
        <SectionHead
          eyebrow="Taste & try"
          title={<>Must try in <span className="italic text-gold-deep">{name}</span></>}
          sub="The street food, the one dish locals will point you to, and the experience everyone remembers. The soul of the place, beyond the sights."
        />
      </Reveal>
      {eat.length > 0 && doIt.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.filter(([, , n]) => n > 0).map(([k, label, n]) => (
            <button key={k} onClick={() => setTab(k)} className={tab === k ? 'chip chip-on' : 'chip'}>{label} <span className="opacity-60">· {n}</span></button>
          ))}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((it, i) => <MustTryCard key={it.id} item={it} index={i} />)}
      </div>
    </section>
  );
}

