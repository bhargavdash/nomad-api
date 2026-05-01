import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getResearchJob } from '../services/research.service.js';
import { getTripById } from '../services/trip.service.js';

const router = Router();

function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/v1/trips/:id/research — poll research job status
router.get('/:id/research', authMiddleware, async (req, res) => {
  const tripId = paramStr(req.params.id);

  // Verify the user owns this trip
  const trip = await getTripById(req.userId!, tripId);
  if (!trip) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }

  const job = await getResearchJob(tripId);
  if (!job) {
    res.status(404).json({ error: 'Research job not found' });
    return;
  }

  res.json({
    status: job.status,
    phase: job.phase,
    progress: job.progress,
    message: job.message,
    stats: {
      places: job.statsPlaces,
      tips: job.statsTips,
      photoStops: job.statsPhotoStops,
    },
    discoveries: job.discoveries,
  });
});

export default router;
