import { Router } from 'express';
import { prisma } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/auth/me — get current user from JWT
router.get('/me', authMiddleware, async (req, res) => {
  const userId = req.userId!;

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  res.json({ profile });
});

export default router;
