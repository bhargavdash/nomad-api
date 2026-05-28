import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import type { CreateTripBody } from '../types/index.js';
import { resolvePlaceImage } from './placeImage.service.js';

type TripWithDays = Prisma.TripGetPayload<{ include: { days: { include: { stops: true } } } }>;

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

  // First read after the itinerary is built: resolve city-led imagery once and
  // cache it in the DB, so every subsequent read ships URLs with zero latency.
  if (!trip.imagesResolvedAt) {
    await resolveTripImages(trip);
  }

  const { days, ...tripData } = trip;
  return { trip: tripData, days };
}

/**
 * Resolve the destination hero + one image per unique city (Wikipedia-backed),
 * persist them, and reflect the values into the passed-in trip object. Cities
 * are deduped so a city repeated across days resolves once. Best-effort: on any
 * failure the trip is still marked resolved (with whatever was found) so we
 * don't re-resolve on every read.
 */
async function resolveTripImages(trip: TripWithDays): Promise<void> {
  const uniqueCities = Array.from(new Set(trip.days.map((d) => d.city).filter(Boolean)));

  const [heroUrl, cityUrls] = await Promise.all([
    resolvePlaceImage(trip.destination),
    Promise.all(uniqueCities.map((city) => resolvePlaceImage(city, trip.destination))),
  ]);

  const cityImage = new Map<string, string | null>();
  uniqueCities.forEach((city, i) => cityImage.set(city, cityUrls[i]));

  const resolvedAt = new Date();

  await prisma.$transaction([
    prisma.trip.update({
      where: { id: trip.id },
      data: { heroImageUrl: heroUrl, imagesResolvedAt: resolvedAt },
    }),
    ...trip.days.map((day) =>
      prisma.itineraryDay.update({
        where: { id: day.id },
        data: { imageUrl: cityImage.get(day.city) ?? null },
      }),
    ),
  ]);

  // Reflect into the object we're about to return (avoids a re-read).
  trip.heroImageUrl = heroUrl;
  trip.imagesResolvedAt = resolvedAt;
  trip.days.forEach((day) => {
    day.imageUrl = cityImage.get(day.city) ?? null;
  });
}

export async function updateTrip(userId: string, tripId: string, data: { status?: string }) {
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
  const existing = await prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
  if (!existing) return null;

  return prisma.trip.delete({
    where: { id: tripId },
  });
}

export async function updateStop(
  userId: string,
  tripId: string,
  stopId: string,
  data: { locked?: boolean; name?: string; description?: string; time?: string; ampm?: string },
) {
  // Verify the stop belongs to a trip owned by this user
  const stop = await prisma.stop.findFirst({
    where: { id: stopId, tripId },
    include: { trip: { select: { userId: true } } },
  });
  if (!stop || stop.trip.userId !== userId) return null;

  return prisma.stop.update({
    where: { id: stopId },
    data,
  });
}

export async function deleteStop(userId: string, tripId: string, stopId: string) {
  const stop = await prisma.stop.findFirst({
    where: { id: stopId, tripId },
    include: { trip: { select: { userId: true } } },
  });
  if (!stop || stop.trip.userId !== userId) return null;

  return prisma.stop.delete({ where: { id: stopId } });
}
