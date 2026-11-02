import { useRef, useState } from 'react';
import { TileLayer } from 'react-leaflet';

interface Provider { url: string; attribution: string; maxZoom: number }

const OSM: Provider = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
};
const ESRI: Provider = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, OpenStreetMap contributors',
  maxZoom: 19,
};

// A custom provider (VITE_TILE_URL) goes first when set; OpenStreetMap and Esri are keyless fallbacks.
const custom: Provider[] = import.meta.env.VITE_TILE_URL
  ? [{ url: import.meta.env.VITE_TILE_URL, attribution: import.meta.env.VITE_TILE_ATTRIBUTION ?? '&copy; OpenStreetMap contributors', maxZoom: 19 }]
  : [];
const PROVIDERS: Provider[] = [...custom, OSM, ESRI];

/**
 * The map's background. No API key needed: it starts with OpenStreetMap and, if its tiles keep failing
 * (blocked, rate-limited, offline hiccup), quietly switches to the next provider.
 */
export function BaseTiles() {
  const [i, setI] = useState(0);
  const errors = useRef(0);
  const p = PROVIDERS[i];
  return (
    <TileLayer
      key={i}
      url={p.url}
      attribution={p.attribution}
      maxZoom={p.maxZoom}
      eventHandlers={{
        tileerror: () => {
          errors.current += 1;
          if (errors.current >= 4 && i < PROVIDERS.length - 1) { errors.current = 0; setI(i + 1); }
        },
      }}
    />
  );
}
