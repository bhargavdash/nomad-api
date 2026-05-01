import { Router } from 'express';
import { prisma } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/v1/auth/sync — upsert Profile from JWT claims
// Call once after Supabase login to ensure the Profile row exists.
// Supabase JWT carries email in payload.email and name/avatar in payload.user_metadata.
router.post('/sync', authMiddleware, async (req, res) => {
  const userId = req.userId!;
  const payload = req.jwtPayload!;

  const email = typeof payload.email === 'string' ? payload.email : null;
  const meta = payload.user_metadata as Record<string, string> | undefined;
  const displayName = meta?.full_name ?? meta?.name ?? null;
  const avatarUrl = meta?.avatar_url ?? null;

  const profile = await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email, displayName, avatarUrl },
    update: {
      ...(email && { email }),
      ...(displayName && { displayName }),
      ...(avatarUrl && { avatarUrl }),
    },
  });

  res.json({ profile });
});

// GET /api/v1/auth/me — get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  const userId = req.userId!;

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  if (!profile) {
    res.status(404).json({ error: 'Profile not found. Call POST /auth/sync first.' });
    return;
  }

  res.json({ profile });
});

export default router;
