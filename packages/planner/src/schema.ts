// Zod schemas shared by the API (validation) and the web app (form defaults).
import { z } from 'zod';
import { CATEGORIES, INTERESTS, type PlanRequest } from './types';

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

export const planRequestSchema = z
  .object({
    destinations: z.array(z.string().min(1)).min(1).max(3),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days: z.number().int().min(1).max(14),
    dayStart: hhmm.default('08:30'),
    dayEnd: hhmm.default('19:00'),
    startPoint: z.object({ name: z.string(), lat: z.number(), lng: z.number() }).nullable().optional(),
    budget: z.number().min(0).max(10_000_000),
    budgetType: z.enum(['per_person', 'total']).default('per_person'),
    companions: z.enum(['solo', 'couple', 'friends', 'family']).default('couple'),
    people: z.number().int().min(1).max(30).default(2),
    kids: z.boolean().default(false),
    elders: z.boolean().default(false),
    interests: z.array(z.enum(INTERESTS)).default([]),
    pace: z.enum(['relaxed', 'balanced', 'packed']).default('balanced'),
    discovery: z.number().min(0).max(100).default(40),
    includeStay: z.boolean().default(true),
    mustInclude: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
    avoid: z.array(z.string()).default([]),
  })
  .refine((r) => r.dayEnd > r.dayStart, { message: 'The day must end after it starts', path: ['dayEnd'] })
  .refine((r) => r.days >= r.destinations.length, { message: 'Give each destination at least one day', path: ['days'] });

export function parsePlanRequest(input: unknown): PlanRequest {
  return planRequestSchema.parse(input) as PlanRequest;
}

export const newPlaceSchema = z.object({
  destinationId: z.string().min(1),
  name: z.string().min(2).max(80),
  category: z.enum(CATEGORIES),
  lat: z.number().min(6).max(37.5),
  lng: z.number().min(68).max(97.6),
  visitMins: z.number().int().min(10).max(600),
  fee: z.number().min(0).max(100000).default(0),
  open: z.string().regex(/^(24h|\d{2}:\d{2}-\d{2}:\d{2})$/).default('06:00-19:00'),
  closedDays: z.array(z.number().int().min(0).max(6)).default([]),
  months: z.array(z.number().int().min(1).max(12)).nullable().default(null),
  score: z.number().min(1).max(10).default(7),
  popularity: z.number().min(1).max(10).default(4),
  description: z.string().min(10).max(600),
  tip: z.string().max(300).optional(),
  wiki: z.string().max(200).optional(),
  avoidKids: z.boolean().default(false),
  avoidElders: z.boolean().default(false),
  evening: z.boolean().default(false),
});
export type NewPlace = z.infer<typeof newPlaceSchema>;
