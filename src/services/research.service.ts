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
