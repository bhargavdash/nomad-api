import { env } from '../env.js';
import { prisma } from '../db/client.js';
import type { CreateTripBody } from '../types/index.js';

/**
 * Trigger the Python nomad-agent service to research a trip.
 *
 * Phase 1 contract (FRONTEND_INTEGRATION_PLAN.md §8):
 *   - Build a snake_case TripParams payload matching nomad-agent/app/schemas.py.
 *   - POST it to AGENT_SERVICE_URL/agent/research with Bearer auth.
 *   - Agent returns 202 immediately; pipeline runs as a FastAPI BackgroundTask
 *     and writes phase/progress/discoveries/days/stops directly to Supabase.
 *   - On non-2xx or fetch failure, mark the research job as failed so the FE
 *     polling loop surfaces an error state.
 *
 * This function is fire-and-forget from the caller's POV — it does not block
 * the HTTP response to the FE. The FE polls /trips/:id/research for progress.
 */
export async function startResearchWorker(
  tripId: string,
  userId: string,
  tripData: CreateTripBody,
): Promise<void> {
  const url = `${env.AGENT_SERVICE_URL}/agent/research`;
  console.log(`[ResearchWorker] tripId=${tripId} userId=${userId} → POST ${url}`);

  const payload = {
    trip_id: tripId,
    user_id: userId,
    destination: tripData.destination,
    date_from: tripData.date_from ?? null,
    date_to: tripData.date_to ?? null,
    duration_days: tripData.duration_days ?? 7,
    travelers: tripData.travelers ?? '2',
    vibes: tripData.vibes ?? [],
    accommodation: tripData.accommodation ?? 'Hotel',
    pace: tripData.pace ?? 'Balanced',
    budget: tripData.budget ?? 'Medium',
    preferences: tripData.preferences ?? null,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.INTERNAL_AGENT_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Agent ${res.status}: ${body.slice(0, 200)}`);
    }

    console.log(`[ResearchWorker] tripId=${tripId} → ${res.status} accepted by agent`);
  } catch (err) {
    // Node's global fetch throws an opaque "fetch failed" — the real reason
    // (ECONNREFUSED, ENOTFOUND, etc.) lives on err.cause. Surface it plus the
    // target URL so a connectivity issue is diagnosable from the stored error
    // instead of a useless "fetch failed".
    let message: string;
    if (err instanceof Error) {
      const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
      const detail = cause?.code ?? cause?.message;
      message = detail ? `${err.message} (${detail}) → ${url}` : `${err.message} → ${url}`;
    } else {
      message = `Agent service unreachable → ${url}`;
    }
    console.error(`[ResearchWorker] tripId=${tripId} → failed:`, message);
    await prisma.researchJob
      .update({
        where: { tripId },
        data: { status: 'failed', error: message },
      })
      .catch((dbErr) => {
        console.error(`[ResearchWorker] tripId=${tripId} → also failed to mark job:`, dbErr);
      });
  }
}
