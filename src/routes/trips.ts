import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth.js';
import * as tripService from '../services/trip.service.js';
import { startResearchWorker } from '../workers/research.worker.js';
import { devLog, devWarn } from '../utils/log.js';

// Key by userId so each authenticated user gets their own independent 10/hour
// bucket. IP-based keying is unfair for users behind shared NAT and less
// meaningful for mobile clients that change IPs frequently. auth runs before
// this limiter so req.userId is guaranteed to be populated.
const tripCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as typeof req & { userId?: string }).userId ?? req.ip ?? 'unknown',
  message: { error: 'Trip creation limit reached. Try again in an hour.' },
});

const router = Router();

function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

// Request validation schema (matches frontend tripPlanStore shape)
const createTripSchema = z.object({
  destination: z.string().min(1),
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),
  duration_days: z.number().optional(),
  travelers: z
    .string()
    .regex(/^\d+$/, 'travelers must be a positive integer')
    .refine((v) => {
      const n = Number(v);
      return n >= 1 && n <= 10;
    }, 'travelers must be between 1 and 10')
    .optional(),
  vibes: z.array(z.string()).optional(),
  accommodation: z
    .enum([
      'Boutique Villa',
      'Luxury Hotel',
      'Eco Lodge',
      'Homestay',
      'Airbnb',
      'Hostel',
      'Custom Stay',
    ])
    .optional(),
  pace: z.enum(['Slow & Soulful', 'Balanced', 'Action-Packed']).optional(),
  budget: z.enum(['Low', 'Medium', 'High', 'Very-High']).optional(),
  preferences: z.string().optional(),
});

// POST /api/v1/trips — create trip + start research
router.post('/', authMiddleware, tripCreationLimiter, async (req, res) => {
  devLog('[POST /trips] userId:', req.userId);
  devLog('[POST /trips] body:', JSON.stringify(req.body, null, 2));

  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) {
    devWarn('[POST /trips] Validation failed:', parsed.error.flatten());
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  devLog('[POST /trips] Validated data:', JSON.stringify(parsed.data, null, 2));

  const { trip, researchJob } = await tripService.createTrip(req.userId!, parsed.data);

  devLog('[POST /trips] Created trip id:', trip.id, '| researchJob id:', researchJob.id);

  // Kick off the research worker (async, non-blocking — fire & forget)
  void startResearchWorker(trip.id, req.userId!, parsed.data);

  res.status(201).json({ trip, research_job: researchJob });
});

// GET /api/v1/trips — list user's trips
router.get('/', authMiddleware, async (req, res) => {
  const status = req.query.status as string | undefined;
  const userTrips = await tripService.listUserTrips(req.userId!, status);
  res.json({ trips: userTrips });
});

// GET /api/v1/trips/:id — get trip summary
router.get('/:id', authMiddleware, async (req, res) => {
  const trip = await tripService.getTripById(req.userId!, paramStr(req.params.id));
  if (!trip) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }
  res.json({ trip });
});

// GET /api/v1/trips/:id/full — get trip with all days and stops
router.get('/:id/full', authMiddleware, async (req, res) => {
  const result = await tripService.getTripFull(req.userId!, paramStr(req.params.id));
  if (!result) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }
  res.json(result);
});

// PATCH /api/v1/trips/:id — update trip
router.patch('/:id', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const updated = await tripService.updateTrip(req.userId!, paramStr(req.params.id), {
    status,
  });
  if (!updated) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }
  res.json({ trip: updated });
});

// DELETE /api/v1/trips/:id — delete trip
router.delete('/:id', authMiddleware, async (req, res) => {
  const deleted = await tripService.deleteTrip(req.userId!, paramStr(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }
  res.json({ deleted: true });
});

const updateStopSchema = z.object({
  locked: z.boolean().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  time: z.string().optional(),
  ampm: z.enum(['AM', 'PM']).optional(),
});

// PATCH /api/v1/trips/:id/stops/:stopId — lock/edit a stop
router.patch('/:id/stops/:stopId', authMiddleware, async (req, res) => {
  const parsed = updateStopSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const stop = await tripService.updateStop(
    req.userId!,
    paramStr(req.params.id),
    paramStr(req.params.stopId),
    parsed.data,
  );

  if (!stop) {
    res.status(404).json({ error: 'Stop not found' });
    return;
  }

  res.json({ stop });
});

// DELETE /api/v1/trips/:id/stops/:stopId — remove a stop
router.delete('/:id/stops/:stopId', authMiddleware, async (req, res) => {
  const deleted = await tripService.deleteStop(
    req.userId!,
    paramStr(req.params.id),
    paramStr(req.params.stopId),
  );

  if (!deleted) {
    res.status(404).json({ error: 'Stop not found' });
    return;
  }

  res.json({ deleted: true });
});

export default router;
