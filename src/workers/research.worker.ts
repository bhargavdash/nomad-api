import { prisma } from '../db/client.js';
import type { Prisma } from '@prisma/client';
import type { CreateTripBody } from '../types/index.js';
import {
  MOCK_PHASES,
  MOCK_DISCOVERIES,
  MOCK_ITINERARY_DAYS,
  MOCK_STOPS_DAY1,
  getMockEmoji,
} from '../services/ai.service.js';

export function startResearchWorker(tripId: string, tripData: CreateTripBody): void {
  const { destination } = tripData;

  console.log(`[ResearchWorker] Starting research for trip ${tripId}`);
  console.log(
    `[ResearchWorker] Context:`,
    JSON.stringify(
      {
        destination,
        dates: { from: tripData.date_from, to: tripData.date_to },
        duration_days: tripData.duration_days,
        travelers: tripData.travelers,
        vibes: tripData.vibes,
        accommodation: tripData.accommodation,
        pace: tripData.pace,
        budget: tripData.budget,
        preferences: tripData.preferences,
      },
      null,
      2,
    ),
  );

  // Update job to researching
  updateJob(tripId, {
    status: 'researching',
    startedAt: new Date(),
  });

  // Schedule each phase update
  for (const phase of MOCK_PHASES) {
    setTimeout(() => {
      const discoveriesSoFar = MOCK_DISCOVERIES.slice(0, phase.phase);

      updateJob(tripId, {
        phase: phase.phase,
        progress: phase.progress,
        message: phase.message,
        statsPlaces: phase.stats.places,
        statsTips: phase.stats.tips,
        statsPhotoStops: phase.stats.photoStops,
        discoveries: discoveriesSoFar as unknown as Prisma.InputJsonValue,
        status: phase.phase === 5 ? 'building' : 'researching',
      });

      console.log(`[ResearchWorker] Trip ${tripId} — Phase ${phase.phase}: ${phase.message}`);
    }, phase.delay);
  }

  // After all phases, write the itinerary and mark complete
  setTimeout(async () => {
    try {
      await writeItinerary(tripId);

      await updateJob(tripId, {
        status: 'completed',
        progress: 100,
        phase: 5,
        message: 'YOUR ITINERARY IS READY!',
        discoveries: MOCK_DISCOVERIES as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      });

      // Update trip status
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          status: 'ready',
          statsPlaces: 38,
          statsTips: 34,
          statsPhotoStops: 17,
          emoji: getMockEmoji(destination),
        },
      });

      console.log(`[ResearchWorker] Trip ${tripId} — Research complete!`);
    } catch (err) {
      console.error(`[ResearchWorker] Trip ${tripId} — Failed:`, err);
      await updateJob(tripId, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, 9600);
}

async function updateJob(tripId: string, data: Prisma.ResearchJobUpdateInput) {
  await prisma.researchJob.update({
    where: { tripId },
    data,
  });
}

async function writeItinerary(tripId: string) {
  for (const day of MOCK_ITINERARY_DAYS) {
    const insertedDay = await prisma.itineraryDay.create({
      data: {
        tripId,
        dayNumber: day.dayNumber,
        city: day.city,
        title: day.title,
        description: day.description,
        highlights: day.highlights,
        stopCount: day.stopCount,
      },
    });

    // Insert stops for day 1 (mock data only has day 1 stops)
    if (day.dayNumber === 1) {
      for (const stop of MOCK_STOPS_DAY1) {
        await prisma.stop.create({
          data: {
            dayId: insertedDay.id,
            tripId,
            sortOrder: stop.sortOrder,
            time: stop.time,
            ampm: stop.ampm,
            duration: stop.duration,
            name: stop.name,
            description: stop.description,
            source: stop.source,
            tags: stop.tags,
            locked: stop.locked,
          },
        });
      }
    }
  }
}
