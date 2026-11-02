// Keeps weather fresh while the page is open: refetches every 10 minutes, when the tab comes back into
// view, and when the device comes back online. Old data stays on screen while a refresh is in flight.
import { useCallback, useEffect, useRef, useState } from 'react';
import { weather, WEATHER_TTL, type WeatherReport } from './api';

export interface LiveWeather {
  data?: WeatherReport;
  error: boolean;
  loading: boolean;
  refresh: () => void;
}

export function useLiveWeather(lat: number, lng: number, days = 6, start?: string): LiveWeather {
  const [data, setData] = useState<WeatherReport>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const last = useRef(0);
  const alive = useRef(true);

  const load = useCallback((fresh: boolean) => {
    setLoading(true);
    weather(lat, lng, start, days, fresh)
      .then((r) => { if (!alive.current) return; setData(r); setError(false); last.current = Date.now(); })
      .catch(() => { if (alive.current) setError(true); })
      .finally(() => { if (alive.current) setLoading(false); });
  }, [lat, lng, start, days]);

  useEffect(() => {
    alive.current = true;
    setData(undefined);
    load(false);
    const stale = () => Date.now() - last.current >= WEATHER_TTL;
    const tick = window.setInterval(() => { if (document.visibilityState === 'visible') load(true); }, WEATHER_TTL);
    const onShow = () => { if (document.visibilityState === 'visible' && stale()) load(true); };
    const onOnline = () => load(true);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('online', onOnline);
    return () => {
      alive.current = false;
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('online', onOnline);
    };
  }, [load]);

  return { data, error, loading, refresh: () => load(true) };
}

/** "just now", "4 min ago", "10:42" */
export function updatedLabel(at?: number, now = Date.now()): string {
  if (!at) return '';
  const min = Math.floor((now - at) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return new Date(at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
