// Keeps computed plans in memory so moving between the itinerary and "How Raahi decided" is instant.
import type { Destination, Place, PlanRequest, PlanResult } from '@raahi/planner';
import { api, destinationDetail, planLocally } from './api';
import { encodeRequest } from './request';

const plans = new Map<string, PlanResult>();
let served = new Set<string>();

export async function getPlan(req: PlanRequest, { local = false } = {}): Promise<PlanResult> {
  const key = encodeRequest(req);
  const hit = plans.get(key);
  if (hit) return hit;
  // the very first plan for a trip goes to the server (it feeds "Trending"); tweaks are computed in the browser
  const plan = local && served.size ? await planLocally(req) : await api.plan(req);
  served.add(key);
  plans.set(key, plan);
  return plan;
}
export const cachedPlan = (req: PlanRequest) => plans.get(encodeRequest(req));

export interface Lookup { places: Map<string, Place & { gem?: boolean }>; destinations: Map<string, Destination> }
export async function lookupFor(ids: string[]): Promise<Lookup> {
  const details = await Promise.all(ids.map(destinationDetail));
  return {
    places: new Map(details.flatMap((d) => d.places.map((p) => [p.id, p] as const))),
    destinations: new Map(details.map((d) => [d.destination.id, d.destination])),
  };
}
export const resetServed = () => { served = new Set(); };
