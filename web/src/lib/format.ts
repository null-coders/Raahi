import { MONTHS } from '@raahi/planner';

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
export const inrShort = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : inr(n));

export const hm = (mins: number) => {
  const m = Math.round(mins);
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const duration = (mins: number) => {
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
};
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

export function monthRanges(months: number[]): string {
  if (!months.length) return '';
  const s = [...new Set(months)].sort((a, b) => a - b);
  if (s.length === 12) return 'All year';
  // join consecutive months, wrapping December → January
  const runs: number[][] = [];
  for (const m of s) {
    const last = runs[runs.length - 1];
    if (last && m === last[last.length - 1] + 1) last.push(m);
    else runs.push([m]);
  }
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1].at(-1) === 12) {
    runs[0] = [...runs.pop()!, ...runs[0]];
  }
  return runs.map((r) => (r.length === 1 ? MONTHS[r[0] - 1] : `${MONTHS[r[0] - 1]}–${MONTHS[r[r.length - 1] - 1]}`)).join(', ');
}

export const CATEGORY_LABEL: Record<string, string> = {
  heritage: 'Heritage', fort: 'Fort', palace: 'Palace', temple: 'Temple', monastery: 'Monastery', church: 'Church',
  mosque: 'Mosque', spiritual: 'Spiritual', nature: 'Nature', viewpoint: 'Viewpoint', lake: 'Lake', beach: 'Beach',
  waterfall: 'Waterfall', wildlife: 'Wildlife', trek: 'Trek', adventure: 'Adventure', market: 'Market', museum: 'Museum',
  garden: 'Garden', village: 'Village', food: 'Food', culture: 'Culture', nightlife: 'Nightlife', cave: 'Caves', island: 'Island',
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Up late?' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const WEATHER: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear', icon: '☀️' }, 1: { label: 'Mostly clear', icon: '🌤️' }, 2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Cloudy', icon: '☁️' }, 45: { label: 'Fog', icon: '🌫️' }, 48: { label: 'Fog', icon: '🌫️' },
  51: { label: 'Drizzle', icon: '🌦️' }, 53: { label: 'Drizzle', icon: '🌦️' }, 55: { label: 'Drizzle', icon: '🌦️' },
  61: { label: 'Rain', icon: '🌧️' }, 63: { label: 'Rain', icon: '🌧️' }, 65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Snow', icon: '🌨️' }, 73: { label: 'Snow', icon: '🌨️' }, 75: { label: 'Heavy snow', icon: '❄️' },
  80: { label: 'Showers', icon: '🌦️' }, 81: { label: 'Showers', icon: '🌧️' }, 82: { label: 'Storms', icon: '⛈️' },
  95: { label: 'Thunderstorm', icon: '⛈️' }, 96: { label: 'Thunderstorm', icon: '⛈️' }, 99: { label: 'Thunderstorm', icon: '⛈️' },
};
export const weatherOf = (code: number) => WEATHER[code] ?? { label: 'Weather', icon: '🌡️' };
