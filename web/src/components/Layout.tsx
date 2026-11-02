import { motion } from 'framer-motion';
import { Bookmark, Compass, Map, PlusCircle, Sparkles } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { isOffline } from '../lib/api';
import { useScrolled } from '../lib/hooks';

const NAV = [
  { to: '/', label: 'Discover', icon: Compass },
  { to: '/plan', label: 'Plan a trip', icon: Map },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/add', label: 'Add a place', icon: PlusCircle },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="Raahi home">
      <motion.span whileHover={{ rotate: 200 }} transition={{ type: 'spring', stiffness: 120, damping: 10 }} className="grid h-9 w-9 place-items-center rounded-full bg-ink shadow-soft">
        <Compass className="h-5 w-5 text-gold" strokeWidth={1.8} />
      </motion.span>
      <span className={`h-display text-2xl font-semibold ${light ? 'text-white' : 'text-ink'}`}>raahi</span>
    </Link>
  );
}

export function TopNav({ overHero = false }: { overHero?: boolean }) {
  const scrolled = useScrolled();
  const light = overHero && !scrolled;
  return (
    <header className={`no-print fixed inset-x-0 top-0 z-40 transition-all duration-500 ${scrolled ? 'bg-cream/85 shadow-soft backdrop-blur-xl' : ''}`}>
      <div className="wrap flex h-16 items-center justify-between sm:h-20">
        <Logo light={light} />
        <nav className="hidden items-center gap-1 rounded-full p-1 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="relative rounded-full px-4 py-2 text-sm font-semibold">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className={`absolute inset-0 rounded-full ${light ? 'bg-white/20' : 'bg-ink'}`} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                  <span className={`relative ${isActive ? (light ? 'text-white' : 'text-white') : light ? 'text-white/85 hover:text-white' : 'text-ink-soft hover:text-ink'}`}>{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <Link to="/plan" className={`md:hidden ${light ? 'btn bg-white/20 text-white backdrop-blur' : 'btn-ink'} !px-4 !py-2`}><Sparkles className="h-4 w-4" />Plan</Link>
      </div>
    </header>
  );
}

/** Floating pill navigation for phones, like a native app. */
export function BottomNav() {
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden">
      <div className="mx-auto flex max-w-sm items-center justify-between rounded-full bg-ink p-1.5 shadow-lift">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="relative flex-1">
            {({ isActive }) => (
              <div className="relative flex flex-col items-center gap-0.5 rounded-full py-2">
                {isActive && <motion.span layoutId="bnav-pill" className="absolute inset-0 rounded-full bg-gold" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                <n.icon className={`relative h-5 w-5 ${isActive ? 'text-ink' : 'text-white/70'}`} strokeWidth={1.8} />
                <span className={`relative text-[10px] font-semibold ${isActive ? 'text-ink' : 'text-white/70'}`}>{n.label.split(' ')[0]}</span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Page({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  const loc = useLocation();
  return (
    <motion.main
      key={loc.pathname}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`min-h-screen pb-28 md:pb-0 ${className}`}
    >
      {children}
    </motion.main>
  );
}

export function Footer() {
  return (
    <footer className="no-print mt-24 border-t border-ink/10 bg-sand-50">
      <div className="wrap grid gap-8 py-12 sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-soft">Trips that fit your budget, your time and the people you travel with.</p>
          <p className="mt-3 text-xs italic text-ink-muted">Some journeys change your destination. Others change you.</p>
        </div>
        <div className="text-sm text-ink-soft">
          <div className="eyebrow mb-3">About the data</div>
          <p>Places, hours and fees are curated and approximate — check before you go. Photos come from Wikimedia Commons contributors (and Pexels/Unsplash when enabled), credited on each image.</p>
        </div>
        <div className="text-sm text-ink-soft">
          <div className="eyebrow mb-3">Maps & weather</div>
          <p>Map data and tiles © OpenStreetMap contributors. Weather by Open-Meteo, refreshed every 10 minutes.</p>
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-white px-3 py-2 text-xs text-ink shadow-soft">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            {isOffline()
              ? 'Maps and weather are live. Trips are planned right on your device, so Raahi works even without a server.'
              : 'Maps and weather are live. Connected to the Raahi server.'}
          </p>
        </div>
      </div>
    </footer>
  );
}
