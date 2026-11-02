import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Search, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SearchHit } from '@raahi/planner';
import { api } from '../lib/api';
import { useClickOutside, useDebounced } from '../lib/hooks';

/** Search-as-you-type over 100+ destinations and 700 places (a trie on the server). */
export function SearchBox({ onPick, placeholder = 'Search destinations or places…', big = false, autoFocus = false, onlyDestinations = false }: {
  onPick?: (hit: SearchHit) => void; placeholder?: string; big?: boolean; autoFocus?: boolean; onlyDestinations?: boolean;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dq = useDebounced(q, 120);
  const nav = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(close);

  useEffect(() => {
    if (!dq.trim()) { setHits([]); return; }
    let alive = true;
    api.search(dq).then((h) => { if (alive) { setHits(onlyDestinations ? h.filter((x) => x.kind === 'destination') : h); setActive(0); } }).catch(() => {});
    return () => { alive = false; };
  }, [dq, onlyDestinations]);

  const pick = (h: SearchHit) => {
    setOpen(false);
    setQ('');
    if (onPick) onPick(h);
    else nav(h.kind === 'destination' ? `/d/${h.id}` : `/p/${h.id}`);
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className={`flex items-center gap-3 rounded-full border border-ink/10 bg-white shadow-soft transition focus-within:border-gold focus-within:shadow-glow ${big ? 'px-6 py-4' : 'px-4 py-3'}`}>
        <Search className={`${big ? 'h-5 w-5' : 'h-4 w-4'} shrink-0 text-ink-muted`} />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === 'Enter' && hits[active]) pick(hits[active]);
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          aria-label="Search"
          className={`w-full bg-transparent outline-none placeholder:text-ink-muted ${big ? 'text-lg' : 'text-[15px]'}`}
        />
      </div>
      <AnimatePresence>
        {open && hits.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-3xl border border-ink/5 bg-white p-2 shadow-lift"
          >
            {hits.map((h, i) => (
              <li key={h.id}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(h)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${i === active ? 'bg-sand-100' : ''}`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${h.kind === 'destination' ? 'bg-ink text-gold' : 'bg-gold-soft text-gold-deep'}`}>
                    {h.kind === 'destination' ? <MapPin className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{h.title}</span>
                    <span className="block truncate text-xs text-ink-muted">{h.kind === 'destination' ? h.subtitle : `Place in ${h.subtitle}`}</span>
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
