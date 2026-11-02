import { animate, motion, useInView, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Bird, Building2, Castle, Church, Compass, Crown, Droplets, Footprints, Gem, Landmark, Leaf, Moon, Mountain,
  Palmtree, ShoppingBag, Sparkles, Tent, TreePine, Utensils, Waves, type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import type { MediaQuery, Photo as PhotoT } from '@raahi/media';
import { usePhotos } from '../lib/hooks';

// ---------------------------------------------------------------- photos

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  heritage: Landmark, fort: Castle, palace: Crown, temple: Sparkles, monastery: Sparkles, church: Church, mosque: Moon,
  spiritual: Sparkles, nature: TreePine, viewpoint: Mountain, lake: Waves, beach: Palmtree, waterfall: Droplets,
  wildlife: Bird, trek: Footprints, adventure: Tent, market: ShoppingBag, museum: Building2, garden: Leaf,
  village: Tent, food: Utensils, culture: Sparkles, nightlife: Moon, cave: Mountain, island: Palmtree,
};

const GRADIENTS = [
  'from-[#C9965B] via-[#D9653B] to-[#16233F]', 'from-[#7FA6BF] via-[#5E7D5A] to-[#16233F]',
  'from-[#E9DCC6] via-[#C9965B] to-[#5E7D5A]', 'from-[#D9653B] via-[#16233F] to-[#2B3A5C]',
];
const withRetry = (src: string, retry: number) => (retry ? `${src}${src.includes('?') ? '&' : '?'}r=1` : src);
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

interface PhotoProps {
  query?: MediaQuery | null;
  photo?: PhotoT;
  index?: number;
  alt: string;
  className?: string;
  imgClassName?: string;
  kenburns?: boolean;
  credit?: boolean;
  icon?: string;
  large?: boolean;
}

/** A real photo with shimmer while loading, a soft fade-in, optional slow zoom and a credit line. */
export function Photo({ query, photo, index = 0, alt, className = '', imgClassName = '', kenburns, credit = true, icon, large }: PhotoProps) {
  const { list, loading } = usePhotos(photo ? null : query ?? null);
  // if a photo fails to load, quietly try the next one before falling back to the gradient
  const [skip, setSkip] = useState(0);
  const pool = photo ? [photo] : list.length ? [...list.slice(index), ...list.slice(0, index)] : [];
  const p = pool[skip];
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { setSkip(0); setRetry(0); setLoaded(false); setBroken(false); }, [photo?.url, list]);
  // Wikimedia sometimes refuses a thumbnail it hasn't made yet; ask once more after a moment,
  // then move on to the next photo
  const onError = () => {
    if (retry === 0) { setTimeout(() => setRetry(1), 1500); return; }
    setRetry(0);
    if (skip + 1 < pool.length) { setSkip(skip + 1); setLoaded(false); } else setBroken(true);
  };
  const Icon = (icon && CATEGORY_ICON[icon]) || Compass;
  const g = GRADIENTS[Math.abs(hash(alt)) % GRADIENTS.length];
  return (
    <div className={`group/photo ${/(^|\s)(absolute|fixed|sticky)(\s|$)/.test(className) ? '' : 'relative'} overflow-hidden bg-sand-100 ${className}`}>
      {(!p || broken) && !loading && (
        <div className={`absolute inset-0 grid place-items-center bg-gradient-to-br ${g}`}>
          <Icon className="h-10 w-10 text-white/70" strokeWidth={1.4} />
        </div>
      )}
      {(loading || (p && !loaded && !broken)) && <div className="skeleton absolute inset-0" />}
      {p && !broken && (
        <img
          src={withRetry(large ? p.url : p.thumb, retry)}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={onError}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'} ${kenburns ? 'animate-kenburns' : ''} ${imgClassName}`}
        />
      )}
      {credit && p && loaded && !broken && (
        <a href={p.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 max-w-[80%] truncate rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/90 opacity-0 backdrop-blur transition group-hover/photo:opacity-100">
          {p.credit}
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- motion helpers

/** Card that tilts in 3D toward the pointer, with a moving sheen. */
export function Tilt({ children, className = '', max = 9 }: PropsWithChildren<{ className?: string; max?: number }>) {
  const x = useMotionValue(0.5), y = useMotionValue(0.5);
  const sx = useSpring(x, { stiffness: 160, damping: 18 }), sy = useSpring(y, { stiffness: 160, damping: 18 });
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const gx = useTransform(sx, [0, 1], ['0%', '100%']);
  const gy = useTransform(sy, [0, 1], ['0%', '100%']);
  const sheen = useMotionTemplate`radial-gradient(600px circle at ${gx} ${gy}, rgba(255,255,255,.22), transparent 40%)`;
  return (
    <motion.div
      className={`relative [transform-style:preserve-3d] ${className}`}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width);
        y.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { x.set(0.5); y.set(0.5); }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {children}
      <motion.div className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: sheen }} />
    </motion.div>
  );
}

export function Reveal({ children, delay = 0, className = '', y = 24 }: PropsWithChildren<{ delay?: number; className?: string; y?: number }>) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0, margin: '0px 0px 160px 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Counter({ value, format = (n: number) => Math.round(n).toLocaleString('en-IN'), className = '' }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const prev = useRef(0);
  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(prev.current, value, {
      duration: 1.1, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { if (ref.current) ref.current.textContent = format(v); },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, inView, format]);
  return <span ref={ref} className={className}>{format(0)}</span>;
}

// ---------------------------------------------------------------- bits

export function SectionHead({ eyebrow, title, action, sub }: { eyebrow?: string; title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h2 className="h-display text-3xl sm:text-4xl">{title}</h2>
        {sub && <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function GemBadge({ small }: { small?: boolean }) {
  return (
    <span className={`pill bg-gradient-to-r from-gold to-terra text-white shadow-soft ${small ? '' : 'px-3 py-1.5'}`}>
      <Gem className="h-3 w-3" /> Hidden gem
    </span>
  );
}

export function CompassLoader({ size = 72 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div className="absolute inset-0 rounded-full border-2 border-dashed border-gold/60" animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} />
      <motion.div className="absolute inset-[18%] grid place-items-center rounded-full bg-ink shadow-lift" animate={{ rotate: [0, 25, -15, 340, 360] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}>
        <Compass className="h-1/2 w-1/2 text-gold" strokeWidth={1.6} />
      </motion.div>
      <motion.span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-terra" style={{ originY: `${size / 2}px` }} animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
    </div>
  );
}

export function Empty({ icon: Icon = Compass, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-gold-soft"><Icon className="h-7 w-7 text-gold-deep" /></div>
      <h3 className="h-display text-2xl">{title}</h3>
      {children && <div className="mt-2 text-ink-soft">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Stat({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sand-100"><Icon className="h-5 w-5 text-ink" strokeWidth={1.7} /></div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="truncate text-[15px] font-semibold text-ink">{value}</div>
        {sub && <div className="text-xs text-ink-muted">{sub}</div>}
      </div>
    </div>
  );
}
