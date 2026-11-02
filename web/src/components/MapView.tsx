import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { BaseTiles } from './BaseTiles';

export interface MapPoint { id: string; lat: number; lng: number; label?: string; title: string; color?: string; href?: string; sub?: string }
export interface MapRoute { points: [number, number][]; color: string; key: string }

export const DAY_COLORS = ['#D9653B', '#16233F', '#5E7D5A', '#C9965B', '#7FA6BF', '#8E5BA8', '#2F8F83', '#B24A6B'];

const icon = (label: string | undefined, color: string, active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div class="raahi-marker ${active ? 'active' : ''}" style="background:${color}">${label ?? ''}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18],
  });
const hubIcon = L.divIcon({ className: '', html: '<div class="raahi-hub">★</div>', iconSize: [30, 30], iconAnchor: [15, 15] });

function Fit({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  const key = pts.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (!pts.length) return;
    if (pts.length === 1) map.setView(pts[0], 13, { animate: true });
    else map.flyToBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 14, duration: 1.2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/** Leaflet with keyless OpenStreetMap tiles. Numbered stops, a star for the start point, routes that draw themselves. */
export function MapView({ points, routes = [], hub, active, className = '', interactive = true }: {
  points: MapPoint[]; routes?: MapRoute[]; hub?: { lat: number; lng: number; name: string }; active?: string | null; className?: string; interactive?: boolean;
}) {
  const all = useMemo<[number, number][]>(() => [
    ...points.map((p) => [p.lat, p.lng] as [number, number]),
    ...(hub ? [[hub.lat, hub.lng] as [number, number]] : []),
  ], [points, hub]);
  const center: [number, number] = all[0] ?? [22.5, 79];
  return (
    <div className={`overflow-hidden ${className}`}>
      <MapContainer center={center} zoom={11} scrollWheelZoom={false} dragging={interactive} zoomControl={interactive} className="h-full w-full" attributionControl>
        <BaseTiles />
        {routes.map((r) => (
          <Polyline key={r.key} positions={r.points} pathOptions={{ color: r.color, weight: 4, opacity: 0.85, className: 'route-line', dashArray: undefined }} />
        ))}
        {hub && <Marker position={[hub.lat, hub.lng]} icon={hubIcon}><Popup><b>{hub.name}</b><br />Start & end point</Popup></Marker>}
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icon(p.label, p.color ?? DAY_COLORS[0], active === p.id)} zIndexOffset={active === p.id ? 1000 : 0}>
            <Popup>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', minWidth: 140 }}>
                <div style={{ fontWeight: 700, color: '#16233F' }}>{p.title}</div>
                {p.sub && <div style={{ fontSize: 12, color: '#4A5568' }}>{p.sub}</div>}
                {p.href && <Link to={p.href} style={{ fontSize: 12, color: '#A8763D', fontWeight: 600 }}>See details →</Link>}
              </div>
            </Popup>
          </Marker>
        ))}
        <Fit pts={all} />
      </MapContainer>
    </div>
  );
}

export const gmapsDir = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}`;
export const gmapsPlace = (p: { lat: number; lng: number; name?: string }) =>
  `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
