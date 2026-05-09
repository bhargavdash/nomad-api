import { prisma } from '../db/client.js';
import type { Prisma } from '@prisma/client';

export async function getResearchJob(tripId: string) {
  return prisma.researchJob.findUnique({
    where: { tripId },
  });
}

export async function updateResearchJob(tripId: string, data: Prisma.ResearchJobUpdateInput) {
  return prisma.researchJob.update({
    where: { tripId },
    data,
  });
}

// On server boot: mark any jobs that were mid-flight when the server died as failed.
// Prevents the frontend from polling forever after a restart.
export async function recoverStaleJobs() {
  const result = await prisma.researchJob.updateMany({
    where: { status: { in: ['researching', 'building'] } },
    data: { status: 'failed', error: 'Server restarted unexpectedly' },
  });
  if (result.count > 0) {
    console.log(`[nomad-api] Recovered ${result.count} stale research job(s) → failed`);
  }
}
