import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import * as tripService from '../services/trip.service.js';
import { startResearchWorker } from '../workers/research.worker.js';

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
  travelers: z.enum(['1', '2', '3+', 'large']).optional(),
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
  budget: z.enum(['$', '$$', '$$$', '$$$$']).optional(),
  preferences: z.string().optional(),
});

// POST /api/v1/trips — create trip + start research
router.post('/', authMiddleware, async (req, res) => {
  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { trip, researchJob } = await tripService.createTrip(req.userId!, parsed.data);

  // Kick off the mock research worker (async, non-blocking)
  startResearchWorker(trip.id, trip.destination);

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
  const { status, emoji } = req.body;
  const updated = await tripService.updateTrip(req.userId!, paramStr(req.params.id), {
    status,
    emoji,
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

export default router;
