import { motion } from 'framer-motion';
import L from 'leaflet';
import { CheckCircle2, MapPin, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { MapContainer, Marker, useMapEvents } from 'react-leaflet';
import { BaseTiles } from '../components/BaseTiles';
import { Link } from 'react-router-dom';
import { CATEGORIES, DAYS, MONTHS } from '@raahi/planner';
import { Footer, Page, TopNav } from '../components/Layout';
import { api, ApiError, destinationDetail } from '../lib/api';
import { CATEGORY_LABEL } from '../lib/format';
import { useAsync } from '../lib/hooks';

const pin = L.divIcon({ className: '', html: '<div class="raahi-marker active" style="background:#D9653B">★</div>', iconSize: [34, 34], iconAnchor: [17, 17] });

function ClickToSet({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Math.round(e.latlng.lat * 1e5) / 1e5, Math.round(e.latlng.lng * 1e5) / 1e5) });
  return null;
}

/** Grow Raahi: add a place you know is worth visiting. It joins the planner straight away. */
export default function AddPlace() {
  const dests = useAsync(() => api.destinations(), []);
  const [f, setF] = useState({
    destinationId: '', name: '', category: 'viewpoint', lat: 0, lng: 0, visitMins: 60, fee: 0, open: '06:00-19:00',
    closedDays: [] as number[], months: [] as number[], description: '', tip: '', score: 8, popularity: 3, avoidKids: false, avoidElders: false, evening: false,
  });
  const [status, setStatus] = useState<{ ok?: string; err?: string; busy?: boolean }>({});
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const center = useAsync(async () => (f.destinationId ? (await destinationDetail(f.destinationId)).destination : null), [f.destinationId]);
  const ready = f.destinationId && f.name.length > 1 && f.lat && f.description.length >= 10;

  const submit = async () => {
    setStatus({ busy: true });
    try {
      const p = await api.addPlace({ ...f, months: f.months.length ? f.months : null, tip: f.tip || undefined });
      setStatus({ ok: p.id });
    } catch (e) {
      setStatus({ err: e instanceof ApiError ? e.message : 'Could not save the place.' });
    }
  };

  if (status.ok) {
    return (
      <Page><TopNav />
        <div className="wrap grid min-h-[70vh] place-items-center pt-28 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <CheckCircle2 className="mx-auto h-16 w-16 text-sage" />
            <h1 className="h-display mt-4 text-4xl">Thank you — it's on the map</h1>
            <p className="mt-2 text-ink-soft">{f.name} can now appear in plans for this destination.</p>
            <div className="mt-6 flex justify-center gap-3"><Link className="btn-ink" to={`/p/${status.ok}`}>See the place</Link><button className="btn-ghost" onClick={() => { setStatus({}); set({ name: '', description: '', tip: '', lat: 0, lng: 0 }); }}>Add another</button></div>
          </motion.div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <TopNav />
      <div className="wrap max-w-4xl pt-28">
        <h1 className="h-display text-5xl">Add a <span className="italic text-gold-deep">place</span></h1>
        <p className="mt-3 text-lg text-ink-soft">Know a spot worth the trip? Add it — Raahi will start planning with it.</p>
        <div className="card mt-10 space-y-6 p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">Destination</span>
              <select className="input" value={f.destinationId} onChange={(e) => set({ destinationId: e.target.value, lat: 0, lng: 0 })}>
                <option value="">Choose…</option>
                {dests.data?.slice().sort((a, b) => a.name.localeCompare(b.name)).map((d) => <option key={d.id} value={d.id}>{d.name} — {d.state}</option>)}
              </select>
            </label>
            <label><span className="label">Name</span><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Hidden lake behind the monastery" /></label>
            <label><span className="label">Kind of place</span>
              <select className="input" value={f.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Time needed (min)</span><input type="number" min={10} max={600} className="input" value={f.visitMins} onChange={(e) => set({ visitMins: Number(e.target.value) })} /></label>
              <label><span className="label">Entry fee (₹)</span><input type="number" min={0} className="input" value={f.fee} onChange={(e) => set({ fee: Number(e.target.value) })} /></label>
            </div>
          </div>
          <div>
            <span className="label flex items-center gap-2"><MapPin className="h-4 w-4" /> Tap the map to set the location {f.lat ? <span className="font-normal text-ink-muted">({f.lat}, {f.lng})</span> : null}</span>
            <div className="h-72 overflow-hidden rounded-3xl">
              {center.data ? (
                <MapContainer key={center.data.id} center={[center.data.lat, center.data.lng]} zoom={11} className="h-full w-full">
                  <BaseTiles />
                  <ClickToSet onPick={(lat, lng) => set({ lat, lng })} />
                  {f.lat !== 0 && <Marker position={[f.lat, f.lng]} icon={pin} />}
                </MapContainer>
              ) : <div className="grid h-full place-items-center bg-sand-100 text-sm text-ink-muted">Choose a destination first</div>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">Opening hours</span>
              <div className="flex items-center gap-2">
                <input type="time" className="input" value={f.open === '24h' ? '00:00' : f.open.split('-')[0]} onChange={(e) => set({ open: `${e.target.value}-${f.open.split('-')[1] ?? '19:00'}` })} />
                <span>–</span>
                <input type="time" className="input" value={f.open === '24h' ? '23:59' : f.open.split('-')[1]} onChange={(e) => set({ open: `${f.open.split('-')[0]}-${e.target.value}` })} />
              </div>
            </label>
            <div><span className="label">Closed on</span>
              <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => <button key={d} onClick={() => set({ closedDays: f.closedDays.includes(i) ? f.closedDays.filter((x) => x !== i) : [...f.closedDays, i] })} className={`chip !px-3 !py-1.5 ${f.closedDays.includes(i) ? 'chip-on' : ''}`}>{d}</button>)}</div>
            </div>
          </div>
          <div><span className="label">Open only in some months? (leave empty for all year)</span>
            <div className="flex flex-wrap gap-1.5">{MONTHS.map((m, i) => <button key={m} onClick={() => set({ months: f.months.includes(i + 1) ? f.months.filter((x) => x !== i + 1) : [...f.months, i + 1] })} className={`chip !px-3 !py-1.5 ${f.months.includes(i + 1) ? 'chip-on' : ''}`}>{m}</button>)}</div>
          </div>
          <label className="block"><span className="label">Why is it worth visiting?</span><textarea className="input min-h-[110px]" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="What makes it special — the view, the people, the history…" /></label>
          <label className="block"><span className="label">A tip for travellers (optional)</span><input className="input" value={f.tip} onChange={(e) => set({ tip: e.target.value })} placeholder="Best time of day, what to carry…" /></label>
          <div className="flex flex-wrap gap-4 text-sm">
            {([['avoidKids', 'Not for small kids'], ['avoidElders', 'Hard for elders'], ['evening', 'Best in the evening']] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={f[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<typeof f>)} className="h-4 w-4 accent-[#16233F]" />{l}</label>
            ))}
          </div>
          {status.err && <div className="rounded-2xl bg-terra-soft px-4 py-3 text-sm">{status.err}</div>}
          <button disabled={!ready || status.busy} onClick={submit} className="btn-ink !py-4"><PlusCircle className="h-5 w-5" /> {status.busy ? 'Adding…' : 'Add this place'}</button>
        </div>
      </div>
      <Footer />
    </Page>
  );
}
