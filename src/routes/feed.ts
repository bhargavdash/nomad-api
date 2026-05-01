import { Router } from 'express';
import { prisma } from '../db/client.js';

const router = Router();

// GET /api/v1/trending — public, no auth needed
router.get('/trending', async (_req, res) => {
  const destinations = await prisma.trendingDestination.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ destinations });
});

// GET /api/v1/insights — public, no auth needed
router.get('/insights', async (_req, res) => {
  const allInsights = await prisma.insight.findMany({
    where: { active: true },
  });

  res.json({ insights: allInsights });
});

export default router;
