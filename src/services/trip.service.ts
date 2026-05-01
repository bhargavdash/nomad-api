import { prisma } from '../db/client.js';
import type { CreateTripBody } from '../types/index.js';

export async function createTrip(userId: string, body: CreateTripBody) {
  const trip = await prisma.trip.create({
    data: {
      userId,
      destination: body.destination,
      dateFrom: body.date_from ?? null,
      dateTo: body.date_to ?? null,
      durationDays: body.duration_days ?? null,
      travelers: body.travelers ?? null,
      vibes: body.vibes ?? [],
      accommodation: body.accommodation ?? null,
      pace: body.pace ?? null,
      budget: body.budget ?? null,
      preferences: body.preferences ?? null,
      status: 'researching',
    },
  });

  const researchJob = await prisma.researchJob.create({
    data: {
      tripId: trip.id,
      status: 'pending',
      phase: 0,
      progress: 0,
      message: 'Starting research...',
    },
  });

  return { trip, researchJob };
}

export async function listUserTrips(userId: string, status?: string) {
  return prisma.trip.findMany({
    where: {
      userId,
      ...(status && { status }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTripById(userId: string, tripId: string) {
  return prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
}

export async function getTripFull(userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
    include: {
      days: {
        orderBy: { dayNumber: 'asc' },
        include: {
          stops: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });

  if (!trip) return null;

  const { days, ...tripData } = trip;
  return { trip: tripData, days };
}

export async function updateTrip(
  userId: string,
  tripId: string,
  data: { status?: string; emoji?: string },
) {
  // Verify ownership first
  const existing = await prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
  if (!existing) return null;

  return prisma.trip.update({
    where: { id: tripId },
    data,
  });
}

export async function deleteTrip(userId: string, tripId: string) {
  // Verify ownership first
  const existing = await prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
  if (!existing) return null;

  return prisma.trip.delete({
    where: { id: tripId },
  });
}
