// The curated dataset, bundled for offline use / the static build. Loaded lazily as its own chunk.
import { expandDataset, type Dataset, type RawDestination } from '@raahi/planner';

const files = import.meta.glob('../../../data/*.json', { eager: true, import: 'default' }) as Record<string, RawDestination[]>;

let cached: Dataset | null = null;
export function dataset(): Dataset {
  cached ??= expandDataset(Object.keys(files).sort().flatMap((k) => files[k]));
  return cached;
}
