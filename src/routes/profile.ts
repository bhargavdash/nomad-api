import { Router } from 'express';
import { prisma } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/profile — get own profile
router.get('/', authMiddleware, async (req, res) => {
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

// PATCH /api/v1/profile — update own profile
router.patch('/', authMiddleware, async (req, res) => {
  const userId = req.userId!;
  const { display_name, avatar_url } = req.body;

  try {
    const updated = await prisma.profile.update({
      where: { id: userId },
      data: {
        ...(display_name !== undefined && { displayName: display_name }),
        ...(avatar_url !== undefined && { avatarUrl: avatar_url }),
      },
    });

    res.json({ profile: updated });
  } catch {
    res.status(404).json({ error: 'Profile not found' });
  }
});

export default router;
