import { useEffect, useRef, useState } from 'react';
import type { MediaQuery, Photo } from '@raahi/media';
import { photos } from './api';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data?: T; error?: Error; loading: boolean; reload: () => void } {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true }));
    fn().then((data) => alive && setState({ data, loading: false })).catch((error) => alive && setState({ error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function usePhotos(q: MediaQuery | null): { list: Photo[]; loading: boolean } {
  const [state, setState] = useState<{ list: Photo[]; loading: boolean }>({ list: [], loading: Boolean(q) });
  const key = q ? JSON.stringify(q) : '';
  useEffect(() => {
    if (!q) return;
    let alive = true;
    setState({ list: [], loading: true });
    photos(q).then((list) => alive && setState({ list, loading: false })).catch(() => alive && setState({ list: [], loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Crossfade through a list on a timer. */
export function useCycle(length: number, ms = 6000): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % length), ms);
    return () => clearInterval(t);
  }, [length, ms]);
  return length ? i % length : 0;
}

export function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

export function useScrolled(px = 24): boolean {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > px);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [px]);
  return s;
}

export function useClickOutside<T extends HTMLElement>(onOut: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOut]);
  return ref;
}
