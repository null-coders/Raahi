import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandDataset, type Dataset, type RawDestination } from '@raahi/planner';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');

/** Read every data/*.json file (each an array of destinations) and expand it. */
export function readRawData(dir = DATA_DIR): RawDestination[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8')) as RawDestination[];
      } catch (e) {
        throw new Error(`data/${f}: ${(e as Error).message}`);
      }
    });
}

export function loadCuratedData(dir = DATA_DIR): Dataset {
  return expandDataset(readRawData(dir));
}
