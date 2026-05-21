# Frontend Integration Plan — Nomad MVP

> **Status:** active — Phase 1 in progress
> **Owner:** Bhargav
> **Started:** 2026-05-20
> **Reference:** `AI_INTEGRATION_PLAN.md` (architecture), `nomad-agent/HANDOFF.md` (agent quality pass), `nomad-agent/BENCHMARK.md` + `nomad-agent/out/rajasthan-sprint7-benchmark.md` (quality verdict that triggered the pause)
> **Companion doc:** [`C:/DevBrain/wiki/projects/nomad-board.md`](C:/DevBrain/wiki/projects/nomad-board.md) — sprint board with Sprint 2/3 status
>
> Read this top-to-bottom before writing any code. Every section is load-bearing.

---

## 0. Why this document exists

The agent quality pass is intentionally paused at ~40% match score on the Rajasthan benchmark. Moving from 40% → 70% needs an OSM/Overpass POI tool + geographic routing layer + curated experiences anchors — none of which is required for an MVP demo, and all of which is much easier to test against once the frontend is showing real output.

The pipeline (`nomad-agent`) and the Node API (`nomad-api`) and the React Native app (`nomad`) currently do not talk to each other end-to-end. The Node worker (`research.worker.ts`) is still on hardcoded `MOCK_PHASES` / `MOCK_DISCOVERIES` data. **This plan closes that loop.**

When this plan is done:

1. A user opens the device app, creates a trip via PlanTrip.
2. PlanTrip POSTs to `nomad-api`, which kicks `nomad-agent` over HTTP.
3. The Python LangGraph pipeline runs (4 research agents in parallel + a 5th long-form YouTube node + synthesizer).
4. The agent writes phase/progress/discoveries to Supabase mid-flight.
5. `ResearchTicker` polls `nomad-api` every 2s, animates through phases, swaps discovery cards.
6. When the pipeline finishes, `nomad-api` reports `status: 'completed'` and the FE navigates to `ItineraryReveal` which fetches the real itinerary.

No SSE. No WebSocket. **Polling-only** by design for MVP.

---

## 1. Scope

### In scope (this plan)

- Wire `nomad-api` → `nomad-agent` over HTTP with internal auth.
- Make the Python pipeline write mid-flight progress (phase, progress, message, stats, discoveries) into `research_jobs`.
- Make the Python writer correctly persist `itinerary_days.stop_count` and `research_jobs.discoveries`.
- Local end-to-end verification on simulator/device.
- Resilience checks (agent crash mid-run, agent unavailable, partial agent failure).

### Out of scope (deferred — listed in §10)

- Agent quality improvements (geo routing, OSM POI tool, curated experiences anchors, sunrise/sunset injection).
- Production deployment of `nomad-agent` (Render / Cloud Run).
- ItineraryReveal stop rendering (UI exists for day cards but not for individual stops).
- Retry-research endpoint (`POST /trips/:id/retry-research`).
- Watchdog timer on stuck pipelines.
- Realtime / SSE / WebSocket. Polling stays.

---

## 2. Architecture

### 2.1 Repos involved

| Repo | Path | Role |
|---|---|---|
| `nomad` | `C:/Users/DELL/code/nomad` | React Native / Expo app. The device client. |
| `nomad-api` | `C:/Users/DELL/code/nomad-api` | Node + Express + Prisma → Postgres (Supabase). Auth, CRUD, polling endpoint. **This repo owns most of the work in Phase 1.** |
| `nomad-agent` | `C:/Users/DELL/code/nomad-agent` | Python + FastAPI + LangGraph. Research agents + synthesizer. Writes directly to Supabase. |

### 2.2 Request lifecycle (end-to-end)

```
[Nomad RN app]                   [nomad-api Node/Prisma]              [nomad-agent FastAPI/LangGraph]
─────────────────                 ─────────────────────                ────────────────────────────────
PlanTrip "Plan My Trip"
  ↓ POST /api/v1/trips
  └── body: TripPlanStore ───►  authMiddleware (Supabase JWT)
                                trip + research_job rows created
                                startResearchWorker(tripId, body)
                                  └── (NEW) fetch POST /agent/research ──►  verify_internal_secret
                                       headers: Authorization: Bearer ${INTERNAL_AGENT_SECRET}
                                       body: TripParams (incl. trip_id, user_id)
                                                                      BackgroundTasks queues
                                                                      _run_and_persist
                                  ◄── 202 { accepted, trip_id }       returns immediately
                                response ─►
  ◄── 201 { trip:{id}, research_job }
  navigate ResearchTicker(tripId)

  loop every 2s:
  GET /api/v1/trips/:id/research ──►  reads research_jobs row         (progress_pacer running)
                                                                      signals
                                                                      youtube ─┐
                                                                      reddit   ├─ parallel,
                                                                      blog     │   discoveries
                                                                      longform ┘   stream into
                                                                                   research_jobs.discoveries
                                                                                   via supabase_writer
                                                                      merge → synthesizer
                                                                      writes itinerary_days + stops
                                                                      marks trip ready + job completed
  ◄── { status, phase, progress, message, stats, discoveries }
  (status === 'completed') → navigate ItineraryReveal
  GET /api/v1/trips/:id/full ──►  trips + days(stops nested)
  ◄── { trip, days[stops] }
```

### 2.3 What runs where

| Concern | Owner | Why |
|---|---|---|
| Supabase JWT verification | `nomad-api` (`authMiddleware`) | Already implemented. No change. |
| Trip + ResearchJob row creation | `nomad-api` (`tripService.createTrip`) | Single source of truth for ownership/RLS. |
| Calling the agent | `nomad-api` (`research.worker.ts`) — to rewrite | Node owns the HTTP boundary. |
| Internal-secret auth at agent boundary | `nomad-agent` (`verify_internal_secret`) | Already implemented. |
| LLM orchestration | `nomad-agent` (LangGraph) | Already implemented. |
| Mid-flight progress writes | `nomad-agent` (new `update_progress` in `supabase_writer.py`) | Agent is the one that knows when phases happen. |
| Final itinerary writes (days + stops + trip stats) | `nomad-agent` (`supabase_writer.py`) | Already implemented; needs `stop_count` fix. |
| Polling response shape | `nomad-api` (`routes/research.ts`) | Already implemented. No change. |
| Trip-full fetch shape | `nomad-api` (`routes/trips.ts` GET /:id/full) | Already implemented. No change. |

---

## 3. Current state audit (2026-05-20)

| Concern | Status | Where |
|---|---|---|
| FE PlanTrip → POST `/api/v1/trips` | ✅ Working | `nomad/src/screens/PlanTrip.tsx:169` |
| Node creates Trip + ResearchJob rows | ✅ Working | `nomad-api/src/services/trip.service.ts:4` |
| Node calls Python agent | ❌ Not wired — uses `MOCK_PHASES` / `MOCK_DISCOVERIES` | `nomad-api/src/workers/research.worker.ts` |
| Node env has agent URL + secret | ❌ Missing from Zod schema | `nomad-api/src/env.ts` |
| Python `/agent/research` endpoint | ✅ Implemented | `nomad-agent/app/routes/research.py:63` |
| Python internal-secret auth | ✅ Implemented | `nomad-agent/app/auth.py:10` |
| Python LangGraph pipeline (5 nodes parallel + merge + synth) | ✅ Implemented | `nomad-agent/app/graph/pipeline.py` |
| Python supabase_writer.write_itinerary | ✅ Implemented — but `stop_count` not set | `nomad-agent/app/db/supabase_writer.py:44` |
| Python supabase_writer.mark_trip_ready | ✅ Implemented | `nomad-agent/app/db/supabase_writer.py:99` |
| Python supabase_writer.update_research_job | ✅ Exists — but only called twice and writes string phase into Int column | `nomad-agent/app/db/supabase_writer.py:32` |
| Python writes discoveries to research_jobs.discoveries | ❌ Missing — function does not exist | (new) |
| Python writes mid-flight progress (phase 1→5, progress %, message) | ❌ Missing — no pacer | (new) |
| FE polls `/api/v1/trips/:id/research` | ✅ Working | `nomad/src/hooks/useResearchTicker.ts:163` |
| FE renders day cards on ItineraryReveal | ✅ Working | `nomad/src/screens/ItineraryReveal.tsx` |
| FE renders stops inside day cards | ❌ Day card shows "{N} stops planned" only, no list | `nomad/src/screens/ItineraryReveal.tsx:130` — **deferred** |

---

## 4. Decisions taken (with rationale)

These are not up for re-discussion mid-implementation. Document them in commit messages if reverting.

### 4.1 DB write path: Python → Supabase direct

**Decision:** the agent service writes directly to the shared Supabase database using a service-role key. Node does not expose an internal "ingest" endpoint.

**Rationale:** `supabase_writer.py` is already implemented and tested against the synthesizer output. Adding a Node ingest endpoint would mean one more network hop, one more schema validation layer, and one more place schema drift can hide. Node still owns auth (JWT verification on the original `POST /api/v1/trips`) — the agent's service-role write is purely persistence.

**Discipline required:**
- Both repos use Prisma's `@map` snake_case column names as the wire contract. **Never rename a column without coordinating the Python writer.**
- All Python writes go through `supabase_writer.py` — no inline `.table().update()` calls scattered across nodes.
- If/when schema drift causes a real bug, revisit the "Python POSTs back to nomad-api" model.

### 4.2 Progress UX: fake sequential progression

**Decision:** the Python service writes phase = 1, 2, 3, 4, 5 on a paced schedule regardless of the actual parallel completion order of the four research agents.

**Rationale:** LangGraph runs YouTube / Reddit / Blog / Long-form in parallel via fan-out. Honest reporting would mean phase numbers bouncing around as different agents finish at different times. The FE animation in `ResearchTicker.tsx` is designed for a clean 1→2→3→4→5 progression. Fake-sequential gives the polished UX the design expects. The discoveries array fills with real data as agents actually finish, so the "LIVE DISCOVERY" card still tells a truthful story.

**Pacer schedule (target):**

| t (s) | phase | progress | message |
|---|---|---|---|
| 0 | 1 | 15 | `SCANNING YOUTUBE VLOGS...` |
| 12 | 2 | 35 | `READING REDDIT THREADS...` |
| 28 | 3 | 55 | `PARSING GOOGLE RESULTS...` |
| 45 | 4 | 75 | `ANALYZING TRAVEL BLOGS...` |
| pipeline returns | 5 | 90 | `BUILDING YOUR ITINERARY...` |
| after persist | 5 | 100 | `YOUR ITINERARY IS READY!` + `status='completed'` |

These timings are estimates from `BENCHMARK.md` (~60-100s end-to-end). If the pipeline finishes faster than the pacer expects, the pacer is cancelled cleanly; if it finishes slower, the pacer stops at phase 4 / 75% and waits.

### 4.3 Phase column stays `Int` in Prisma

**Decision:** `research_jobs.phase` remains `Int` in Prisma. Python writes integers (1..5) only. Human-readable label lives in `message`.

**Rationale:** Changing to a string enum would ripple through `routes/research.ts`, the FE `PHASE_TO_SOURCE` map, and require a migration. Zero benefit for MVP.

### 4.4 No SSE / WebSocket — polling only

**Decision:** FE polls `/api/v1/trips/:id/research` every 2s. No streaming.

**Rationale:** Polling is already implemented and works. SSE through Node + a service-role Supabase write would add machinery for a 2-minute animation. Defer indefinitely.

---

## 5. Missing links (concrete, ordered by phase)

| ID | Where | Issue | Phase |
|---|---|---|---|
| L1 | `nomad-api/src/workers/research.worker.ts` | Still uses `MOCK_PHASES` / `MOCK_DISCOVERIES`. Never calls Python. | 1 |
| L2 | `nomad-api/src/env.ts` | Missing `AGENT_SERVICE_URL`, `INTERNAL_AGENT_SECRET` in Zod schema. | 1 |
| L3 | `nomad-agent/app/routes/research.py:32-52` | Writes string `phase="synthesizing"` into `research_jobs.phase` which is `Int`. | 1 |
| L4 | `nomad-agent/app/routes/research.py` | No mid-pipeline progress writes — FE stuck at "STARTING RESEARCH..." for 60-100s. | 2 |
| L5 | `nomad-agent/app/db/supabase_writer.py` | Never writes the `discoveries` JSON array to `research_jobs.discoveries`. | 2 |
| L6 | `nomad-agent/app/db/supabase_writer.py:55-67` | Day rows don't set `stop_count`. FE shows "0 stops planned". | 2 |
| L7 | `nomad-agent/app/schemas.py` `TripParams` | Requires `trip_id` + `user_id`. Node currently doesn't send these. | 1 |
| L8 | `nomad-api/src/services/ai.service.ts` | Mock data file. Kept (or deleted) — not blocking but worth removing once L1 is in. | 1 (cleanup) |
| L9 | `nomad-agent/app/main.py` | Health is `/agent/health`, not `/health`. Worker can health-check before fan-out (optional). | 1 (nice-to-have) |
| L10 | `nomad/src/screens/ItineraryReveal.tsx` | Renders day cards but not stop lists. | **Deferred** |

---

## 6. JSON contract

### 6.1 What the synthesizer emits (Python schema)

From `nomad-agent/app/schemas.py`:

```python
class AIItinerary(BaseModel):
    emoji: str                                  # 1-4 chars
    stats_places: int
    stats_tips: int
    stats_photo_stops: int
    discoveries: list[ResearchDiscovery]        # 3-12
    days: list[AIDay]                           # >= 1

class AIDay(BaseModel):
    dayNumber: int                              # >= 1
    city: str
    title: str
    description: str
    highlights: list[str]                       # 2-5
    stops: list[AIStop]                         # 2-6

class AIStop(BaseModel):
    sortOrder: int                              # >= 1
    time: str                                   # "HH:MM" pattern
    ampm: Literal["AM", "PM"]
    duration: str                               # e.g. "1 hour"
    name: str
    description: str
    source: Literal["youtube", "reddit", "blog", "maps"]
    tags: list[str]                             # 1-4

class ResearchDiscovery(BaseModel):
    id: str
    title: str
    body: str
    tags: list[str]                             # 1-3
    source: Literal["youtube", "reddit", "blog", "maps"]
```

### 6.2 Mapping to Prisma tables (camelCase model fields, snake_case DB columns)

| AIItinerary field | Prisma table.column | Notes |
|---|---|---|
| `emoji` | `Trip.emoji` (`trips.emoji`) | Written by `mark_trip_ready` |
| `stats_places` | `Trip.statsPlaces` (`trips.stats_places`) **AND** `ResearchJob.statsPlaces` (`research_jobs.stats_places`) | Both need writing. Trip = final; ResearchJob = polled by FE during run. |
| `stats_tips` | `Trip.statsTips` / `ResearchJob.statsTips` | Same as above. |
| `stats_photo_stops` | `Trip.statsPhotoStops` / `ResearchJob.statsPhotoStops` | Same as above. |
| `discoveries[]` | `ResearchJob.discoveries` (`research_jobs.discoveries`) — JSONB column | **Currently never written** (L5). |
| `days[].dayNumber` | `ItineraryDay.dayNumber` (`itinerary_days.day_number`) | ✅ written |
| `days[].city` | `ItineraryDay.city` | ✅ |
| `days[].title` | `ItineraryDay.title` | ✅ |
| `days[].description` | `ItineraryDay.description` | ✅ |
| `days[].highlights` | `ItineraryDay.highlights` (`text[]`) | ✅ |
| `len(days[].stops)` | `ItineraryDay.stopCount` (`itinerary_days.stop_count`) | **Currently never written** (L6) — defaults to 0. |
| `days[].stops[].sortOrder` | `Stop.sortOrder` | ✅ |
| `days[].stops[].time` | `Stop.time` | ✅ |
| `days[].stops[].ampm` | `Stop.ampm` | ✅ |
| `days[].stops[].duration` | `Stop.duration` | ✅ |
| `days[].stops[].name` | `Stop.name` | ✅ |
| `days[].stops[].description` | `Stop.description` | ✅ |
| `days[].stops[].source` | `Stop.source` | ✅ |
| `days[].stops[].tags` | `Stop.tags` (`text[]`) | ✅ |
| `Stop.locked` | not in AI schema — defaults `false` | ✅ |
| `Stop.tripId` | derived from input | ✅ |
| `Stop.dayId` | derived from inserted day row id | ✅ |

### 6.3 FE polling response (Node owns the translation)

`GET /api/v1/trips/:id/research` returns:

```json
{
  "status": "researching",
  "phase": 2,
  "progress": 35,
  "message": "READING REDDIT THREADS...",
  "stats": { "places": 12, "tips": 14, "photoStops": 5 },
  "discoveries": [
    {
      "id": "uuid",
      "title": "Skip Nahargarh at noon — sunset is 10x better.",
      "body": "...",
      "tags": ["#ProTip", "#GoldenHour"],
      "source": "youtube"
    }
  ]
}
```

This translation is already done in `nomad-api/src/routes/research.ts:29-40`. **No Node-side changes needed for the polling endpoint.**

### 6.4 FE trip-full response (existing)

`GET /api/v1/trips/:id/full` returns `{ trip, days[stops] }`. Already wired in `nomad-api/src/routes/trips.ts:79`. No change.

---

## 7. DB writes required (summary)

| Row | When | What | Helper to add/use |
|---|---|---|---|
| `research_jobs` | mid-flight (every ~5-15s) | `phase`, `progress`, `message` | new `update_progress(trip_id, phase, progress, message)` |
| `research_jobs` | mid-flight (1-2 times) | `stats_places`, `stats_tips`, `stats_photo_stops` | new `update_research_job_stats(...)` OR fold into `update_progress` |
| `research_jobs` | mid-flight (after merge_node) | `discoveries` JSONB | new `write_discoveries(trip_id, discoveries: list[ResearchDiscovery])` |
| `itinerary_days` (with `stop_count`) | end | one row per day, `stop_count = len(day.stops)` | fix in `write_itinerary` |
| `stops` | end | one row per stop | already in `write_itinerary` |
| `trips` | end | `status='ready'`, `emoji`, `stats_*` | `mark_trip_ready` (already exists) |
| `research_jobs` | end | `status='completed'`, `phase=5`, `progress=100`, `completed_at` | extend `update_research_job` (already exists) |
| `trips` + `research_jobs` | on error | `status='failed'`, `error=...` | `mark_trip_failed` (already exists) |

**No schema migrations required.** All columns already exist.

---

## 8. Implementation phases

> Each phase is independently mergeable. Acceptance criteria are the literal definition of done for that phase. Do not advance until acceptance is met.

---

### Phase 1 — Node ↔ Python wire (NOW)

**Goal:** trigger the real Python pipeline from Node. Pipeline must run end-to-end and write the final itinerary to Supabase. Mid-flight progress UX is **not** in scope for this phase — Phase 2 handles that. For Phase 1, the FE will see status flip from `pending`/`researching` to `completed` once the pipeline finishes.

#### Files to change

| File | Change |
|---|---|
| `nomad-api/src/env.ts` | Add `AGENT_SERVICE_URL` (URL) and `INTERNAL_AGENT_SECRET` (string) to the Zod schema. Required in `production`, optional in `development` with a clear runtime error if used unset. |
| `nomad-api/.env.example` | Document the two new vars with example values. |
| `nomad-api/src/workers/research.worker.ts` | Rewrite. Remove all `MOCK_*` imports. Build a Python-compatible `TripParams` payload (snake_case, includes `trip_id` + `user_id`). Use Node's built-in `fetch` to POST to `${env.AGENT_SERVICE_URL}/agent/research` with `Authorization: Bearer ${env.INTERNAL_AGENT_SECRET}` and the JSON body. Handle 2xx vs non-2xx: on non-2xx, update the research_job to `status='failed'` with an error message. On 2xx, do nothing (Python writes the rest). |
| `nomad-api/src/routes/trips.ts` | `startResearchWorker(trip.id, parsed.data)` call must also pass `userId` (extract from `req.userId`). Signature change. |
| `nomad-api/src/services/ai.service.ts` | Delete (or move behind a `USE_MOCK_AGENT` flag — cleaner to delete, the file is dead weight). |
| `nomad-agent/.env.example` | (already has `INTERNAL_AGENT_SECRET`) — verify documented. |
| `nomad-agent/app/routes/research.py` | Fix `phase` writes — currently passes string `phase="synthesizing"` into Int column. Replace with int phase values (1 / 5). |

#### Payload shape (Node → Python)

The Python `TripParams` schema is the contract. Node MUST send these exact snake_case keys:

```json
{
  "trip_id": "<uuid>",
  "user_id": "<supabase-auth-uid>",
  "destination": "Goa, India",
  "date_from": "2026-12-15",
  "date_to": "2026-12-22",
  "duration_days": 7,
  "travelers": "2",
  "vibes": ["beaches", "nightlife"],
  "accommodation": "Hotel",
  "pace": "Balanced",
  "budget": "$$",
  "preferences": "early check-in, stroller-friendly"
}
```

**Allowed values** (per `nomad-agent/app/schemas.py`):
- `travelers`: `"1" | "2" | "3+" | "large"`
- `pace`: `"Slow & Soulful" | "Balanced" | "Action-Packed"`
- `budget`: `"$" | "$$" | "$$$" | "$$$$"`
- `accommodation`: any string — Python `TripParams.accommodation` is `str = "Hotel"`. (Node's Zod enum is stricter; the agent doesn't validate it.)

**Defaults if missing on the Node side:**
- `duration_days`: 7
- `travelers`: `"2"`
- `pace`: `"Balanced"`
- `budget`: `"$$"`
- `preferences`: `None`

#### Code skeleton (illustrative — research.worker.ts)

```ts
import { env } from '../env.js';
import { prisma } from '../db/client.js';
import type { CreateTripBody } from '../types/index.js';

export async function startResearchWorker(
  tripId: string,
  userId: string,
  tripData: CreateTripBody,
): Promise<void> {
  console.log(`[ResearchWorker] tripId=${tripId} → POST ${env.AGENT_SERVICE_URL}/agent/research`);

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
    budget: tripData.budget ?? '$$',
    preferences: tripData.preferences ?? null,
  };

  try {
    const res = await fetch(`${env.AGENT_SERVICE_URL}/agent/research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.INTERNAL_AGENT_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Agent service responded ${res.status}: ${errText.slice(0, 200)}`);
    }

    console.log(`[ResearchWorker] tripId=${tripId} → 202 accepted by agent`);
  } catch (err) {
    console.error(`[ResearchWorker] tripId=${tripId} → fetch failed:`, err);
    await prisma.researchJob.update({
      where: { tripId },
      data: {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Agent service unreachable',
      },
    });
  }
}
```

#### Acceptance criteria — Phase 1

1. `nomad-api` boots without `MOCK_PHASES` or `MOCK_DISCOVERIES` imports anywhere in `src/`.
2. `npm run build` (or `tsc --noEmit`) passes with zero errors.
3. POSTing to `http://localhost:3000/api/v1/trips` (with a valid Supabase JWT) returns 201 with `{ trip, research_job }`.
4. The Python service receives the POST: `nomad-agent` log shows `INFO:app.routes.research:trip_id=<uuid> accepted`.
5. The Python service authenticates: passes with the matching `INTERNAL_AGENT_SECRET`; rejects 401 with a wrong secret.
6. The pipeline runs end-to-end without crash (allow 60-120s) and `SELECT status, emoji FROM trips WHERE id = '<uuid>'` returns `status='ready'` with a non-null emoji.
7. `SELECT count(*) FROM itinerary_days WHERE trip_id = '<uuid>'` returns >= 1 and `SELECT count(*) FROM stops WHERE trip_id = '<uuid>'` returns >= 2.
8. `SELECT status FROM research_jobs WHERE trip_id = '<uuid>'` returns `'completed'`.
9. Negative path: kill the `nomad-agent` process before POSTing → Node logs the fetch failure → `research_jobs.status = 'failed'` → FE eventually shows error state. (Polling will continue until `MAX_CONSECUTIVE_FAILURES=3` is hit or it sees `status='failed'`.)
10. Negative path: wrong `INTERNAL_AGENT_SECRET` in nomad-api → Python returns 401 → Node logs 401 → research_job marked failed.

#### Definition of done — Phase 1

- All 10 acceptance criteria pass on local dev.
- `services/ai.service.ts` deleted from nomad-api.
- A device run of `PlanTrip` → submits → eventually navigates to `ItineraryReveal` with real day cards (even if mid-flight UX is jumpy — that's Phase 2's job).
- This doc updated with Phase 1 marked complete and any deviations noted.

#### Out of scope for Phase 1

- Pacer / live discovery streaming (Phase 2).
- `stop_count` fix (Phase 2 — does not block the device from rendering day cards; just shows "0 stops planned").
- ItineraryReveal stop list rendering (deferred entirely).
- Deployment of `nomad-agent` to a cloud service (the user runs both services locally).
- Watchdog timer on stuck pipelines.

---

### Phase 2 — Live progress, discoveries, stop_count

**Goal:** the `ResearchTicker` screen animates through 5 phases, the "LIVE DISCOVERY" card swaps to real agent discoveries during the run, the stats counter increments, and the `ItineraryReveal` day cards show the correct stop count.

#### Files to change

| File | Change |
|---|---|
| `nomad-agent/app/db/supabase_writer.py` | Add `update_progress(trip_id, phase: int, progress: int, message: str)`. Add `write_discoveries(trip_id, discoveries: list[ResearchDiscovery])` — serialises each discovery to dict + writes to `research_jobs.discoveries` JSONB column. Add `update_research_job_stats(trip_id, places, tips, photo_stops)` OR fold into `update_progress`. Fix `write_itinerary` to populate `stop_count`. |
| `nomad-agent/app/routes/research.py` | Add `progress_pacer(trip_id)` async function. Launch as `asyncio.create_task` at the start of `_run_and_persist`. Cancel cleanly when the pipeline returns. Write discoveries to DB in two chunks (~50% and ~100%) using `write_discoveries`. After synth completes but before `write_itinerary`, write `phase=5, progress=90, message='BUILDING YOUR ITINERARY...'`. |
| `nomad-agent/app/graph/pipeline.py` | (optional) expose `all_discoveries` via the pipeline state so the route can chunk-write. Already exposed — just need to call `write_discoveries(state["all_discoveries"])` after `merge_node`. The simplest path: hook the chunking into the pacer (writes whatever's currently in the DB, lifting the chunk count over time). |

#### Pacer behaviour (definitive)

The pacer is a coroutine that:
- writes phase=1, progress=15, message='SCANNING YOUTUBE VLOGS...' immediately
- sleeps 12s, writes phase=2, progress=35, message='READING REDDIT THREADS...'
- sleeps 16s, writes phase=3, progress=55, message='PARSING GOOGLE RESULTS...'
- sleeps 17s, writes phase=4, progress=75, message='ANALYZING TRAVEL BLOGS...'
- sleeps 15s, writes phase=4, progress=85 — and **stops there** waiting for cancellation

After `run_pipeline()` returns, `_run_and_persist`:
- cancels the pacer
- writes phase=5, progress=90, message='BUILDING YOUR ITINERARY...'
- calls `write_discoveries(final["all_discoveries"])`
- calls `write_itinerary` (with `stop_count` fix)
- calls `mark_trip_ready`
- writes phase=5, progress=100, message='YOUR ITINERARY IS READY!', status='completed'

If the pipeline finishes very fast (< 30s), the pacer is cancelled before it walks through all phases — that's fine, the FE just sees phases 1-2 then jumps to 5. If the pipeline takes > 90s, the pacer stops at phase=4/85% and waits — also fine.

#### Discoveries streaming (mid-flight)

Two write points to keep the FE's discovery card swapping:

1. **First write:** when the pacer hits phase=3 (~28s in), write the first half of whatever `final["all_discoveries"]` will be — except we don't have it yet. Simpler: poll the LangGraph state's accumulating discoveries via a shared object. **Even simpler for Phase 2:** call `write_discoveries` with `state["yt_discoveries"]` + `state["yt_longform_discoveries"]` if available at pacer phase 3, and the full merged list at pacer end.

   **Cleanest implementation:** add per-agent write hooks inside `merge_node` — after merge completes, do `await supabase_writer.write_discoveries(trip_id, state["all_discoveries"][:5])`. Then in `_run_and_persist` after the pipeline returns, write the full list. Two writes; clear semantics; FE animates twice. **Use this approach.**

2. **Final write:** after pipeline returns, before `write_itinerary`, write the full `all_discoveries`.

Discovery payload must serialize each `ResearchDiscovery` to dict (Pydantic `.model_dump()`).

#### `stop_count` fix

In `write_itinerary`, the day_rows dict comprehension currently omits `stop_count`. Change to:

```python
day_rows = [
    {
        "trip_id": trip_id,
        "day_number": d.dayNumber,
        "city": d.city,
        "title": d.title,
        "description": d.description,
        "highlights": d.highlights,
        "stop_count": len(d.stops),    # NEW
    }
    for d in itinerary.days
]
```

#### Acceptance criteria — Phase 2

1. A device run of a Goa trip shows the orb spinning + progress bar climbing through 5 phases with distinct messages between PlanTrip submit and ItineraryReveal.
2. The "LIVE DISCOVERY" card swaps at least twice during a run, showing real titles (NOT "Starting your research...").
3. Stats counter (PLACES / TIPS / PHOTO STOPS) shows numbers updating mid-run.
4. After completion, `SELECT discoveries FROM research_jobs WHERE trip_id = '<uuid>'` returns a non-empty JSON array (3+ items).
5. After completion, every `itinerary_days.stop_count` value equals the actual count of stops in that day (verified by SQL join).
6. ItineraryReveal day cards display the real stop count, not "0 stops planned".
7. Pacer cancellation works cleanly — no warning log "Task was destroyed but it is pending!" when pipeline finishes fast or slow.
8. Stats values on the `research_jobs` row are non-zero during the run, not just at the end.

#### Definition of done — Phase 2

- All 8 acceptance criteria pass on device.
- The Rajasthan sample produces a complete itinerary with discoveries streaming, finishing in 60-120s, with the progress UX feeling intentional and smooth (not jumpy).
- This doc updated with Phase 2 marked complete.

---

### Phase 3 — E2E sign-off + resilience

**Goal:** prove the integration works under realistic failure conditions and across multiple destinations.

#### Test matrix

| Test | Setup | Expected |
|---|---|---|
| Happy path A | Goa Dec 15-22, 2 travelers, vibes=beaches+nightlife, pace=Balanced | Itinerary completes in 60-120s, ≥7 days, ≥2 stops/day, mix of YouTube/Reddit/blog/maps sources |
| Happy path B | Manali Jul 10-17, 2 travelers, vibes=adventure+mountains, pace=Action-Packed | Same — plus Reddit warnings about monsoon should surface on Day 1 description |
| Happy path C | Rajasthan Dec 20-31, 2 travelers | Same — 11 days, multi-city, anchor stops in real Rajasthan cities |
| Agent unavailable | Kill `nomad-agent` before creating trip | Trip ends in `status='failed'`, FE shows error state within ~6s (3 poll failures) |
| Agent crash mid-run | Kill `nomad-agent` 20s into a Goa run | Pacer stops writing; FE keeps polling; eventually trip stuck in `researching`. On next nomad-api restart, `recoverStaleJobs` marks it `failed`. **Document this as known limitation — watchdog deferred.** |
| One agent fails | Set `YOUTUBE_API_KEY=invalid` in `nomad-agent/.env`; run Goa | Pipeline completes; itinerary has 0 YouTube discoveries but Reddit + Blog still present; status='ready' |
| Bad JWT | POST `/api/v1/trips` with expired/missing token | 401 from authMiddleware; no agent call made |
| Wrong internal secret | Mismatch `INTERNAL_AGENT_SECRET` between Node and Python | Node logs 401 from Python; research_jobs marked failed |

#### Acceptance criteria — Phase 3

1. All three happy-path destinations complete on a device with itinerary cards rendering.
2. Agent unavailable → FE error state shows within 6s.
3. One agent failure → pipeline degrades gracefully, partial itinerary lands.
4. Bad JWT and wrong internal secret both fail with the right HTTP code and the FE shows the right error.
5. No silent failures — every error path is either visible in the FE (error toast / error screen) or logged in nomad-api console.

#### Definition of done — Phase 3

- Test matrix complete with results captured in this doc.
- Known limitations (agent crash mid-run leaving stuck `researching` rows) documented as a Phase 4 follow-up.
- This doc updated with Phase 3 marked complete.
- The board (`C:/DevBrain/wiki/projects/nomad-board.md`) updated to mark AI-10, AI-11, AI-12 done.

---

## 9. Risks / deferred

| Item | Mitigation now | Plan later |
|---|---|---|
| Agent crashes mid-run → `research_jobs.status` stays `researching` forever (until nomad-api restart) | `recoverStaleJobs` runs on Node boot — eventually self-heals | Add a Python-side watchdog: every `_run_and_persist` wraps the pipeline in `asyncio.wait_for(..., timeout=300)` and marks failed on timeout |
| Retry — FE's retry button just re-polls, doesn't re-fire the pipeline | Document as known | New `POST /api/v1/trips/:id/retry-research` endpoint that calls `startResearchWorker` again |
| Two services writing to the same Supabase DB | Tight discipline on column names via Prisma `@map` + single-writer module (`supabase_writer.py`) | If schema drift bites, switch to "Python POSTs JSON back to nomad-api ingest endpoint" model |
| ItineraryReveal doesn't render individual stops, only day summary cards | Acceptable for MVP demo of "agent works end-to-end" | Sprint 4 — add a `DayDetail` screen or expand day card on tap |
| Pacer timings might not match real pipeline duration | Pacer caps at phase 4 if pipeline is slow; gets cancelled if fast | Telemetry pass — measure real timings, adjust pacer to match P50 |
| `phase Int` is coarse | Use `message` field to convey nuance (e.g. "READING REDDIT THREADS — 8/15 posts processed") | Switch to phase string enum if richer phase data becomes useful |
| LangGraph errors → `mark_trip_failed` runs but the FE polling has no specific error message | Generic error state fires | Surface `error` field in polling response |
| Source diversity per stop not surfaced in FE | Source-attribution data is there in `Stop.source` | Sprint 4 — add small source badges to stop cards |

---

## 10. Reference: env vars (new + existing)

### `nomad-api/.env` (additions)

```bash
# Agent service — Phase 1 required
AGENT_SERVICE_URL=http://localhost:8001
INTERNAL_AGENT_SECRET=change-me-to-match-nomad-agent-env
```

### `nomad-agent/.env` (existing — must match)

```bash
INTERNAL_AGENT_SECRET=change-me-to-match-nomad-agent-env
```

**Critical:** the secret value must be byte-identical in both `.env` files. Mismatched secret → 401 → trip fails.

---

## 11. Reference: example payloads

### Phase 1 — Node → Python POST `/agent/research`

```http
POST /agent/research HTTP/1.1
Host: localhost:8001
Authorization: Bearer change-me-to-match-nomad-agent-env
Content-Type: application/json

{
  "trip_id": "a1b2c3d4-...",
  "user_id": "u-supabase-auth-uid",
  "destination": "Goa, India",
  "date_from": "2026-12-15",
  "date_to": "2026-12-22",
  "duration_days": 7,
  "travelers": "2",
  "vibes": ["beaches", "nightlife", "street food"],
  "accommodation": "Boutique Villa",
  "pace": "Balanced",
  "budget": "$$",
  "preferences": null
}
```

### Phase 1 — Python → Node response

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "accepted": true,
  "trip_id": "a1b2c3d4-..."
}
```

### Phase 2 — Final `/api/v1/trips/:id/research` response near completion

```json
{
  "status": "completed",
  "phase": 5,
  "progress": 100,
  "message": "YOUR ITINERARY IS READY!",
  "stats": { "places": 9, "tips": 1, "photoStops": 4 },
  "discoveries": [
    {
      "id": "ab12...",
      "title": "Mehrangarh Fort, Jodhpur",
      "body": "15th-century former palace that's now a museum...",
      "tags": ["history", "photography"],
      "source": "blog"
    }
  ]
}
```

### Phase 2 — Final `/api/v1/trips/:id/full` response

```json
{
  "trip": {
    "id": "a1b2...",
    "destination": "Goa, India",
    "durationDays": 7,
    "statsPlaces": 9,
    "statsTips": 1,
    "statsPhotoStops": 4,
    "emoji": "🌴"
  },
  "days": [
    {
      "id": "d1...",
      "dayNumber": 1,
      "city": "North Goa",
      "title": "Arrival and Beach Time",
      "description": "Start your day at Baga Beach...",
      "highlights": ["Baga Beach", "Anjuna Flea Market"],
      "stopCount": 3,
      "stops": [
        {
          "id": "s1...",
          "sortOrder": 1,
          "time": "10:00",
          "ampm": "AM",
          "duration": "2 hours",
          "name": "Baga Beach",
          "description": "...",
          "source": "youtube",
          "tags": ["beach", "morning"],
          "locked": false
        }
      ]
    }
  ]
}
```

---

## 12. Reference: how to run locally

```powershell
# Terminal 1 — Postgres / Supabase already running (skip if using cloud Supabase)

# Terminal 2 — nomad-api
cd C:/Users/DELL/code/nomad-api
npm run dev
# Expect: [nomad-api] Server running on http://localhost:3000

# Terminal 3 — nomad-agent
cd C:/Users/DELL/code/nomad-agent
uv run uvicorn app.main:app --reload --port 8001
# Expect: INFO:     Application startup complete.
# Expect: GET /agent/health → 200 {"status":"ok","service":"nomad-agent"}

# Terminal 4 — Expo / Metro
cd C:/Users/DELL/code/nomad
npm start
# Then open simulator/device
```

**Env checklist before kicking off a trip:**

- `nomad-api/.env`: `DATABASE_URL`, `AGENT_SERVICE_URL=http://localhost:8001`, `INTERNAL_AGENT_SECRET=<value>`
- `nomad-agent/.env`: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_AGENT_SECRET=<same value>`, `YOUTUBE_API_KEY`, `TAVILY_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`
- `nomad/.env` or `app.config`: `EXPO_PUBLIC_API_URL=http://localhost:3000` (or your machine's LAN IP for physical device)

---

## 13. Progress log

| Date | Phase | Status | Notes |
|---|---|---|---|
| 2026-05-20 | 0 | Doc written | Plan agreed; decisions §4 confirmed. |
| 2026-05-20 | 1 | Code-complete | nomad-api: env.ts adds AGENT_SERVICE_URL + INTERNAL_AGENT_SECRET (Zod required, secret min 16). .env.example documents both. research.worker.ts rewritten to POST nomad-agent /agent/research with Bearer auth; non-2xx + fetch failures mark research_job failed. routes/trips.ts passes req.userId to worker. services/ai.service.ts deleted. nomad-agent: routes/research.py fixed to write phase as Int (5, not string "synthesizing"/"done") + added message field on both update_research_job calls. tsc --noEmit clean. ast.parse(research.py) clean. Awaiting user E2E verification (acceptance criteria #3-10). |
| TBD | 1 | E2E verified | — |
| TBD | 2 | — | — |
| TBD | 3 | — | — |

---

*End of plan. Future agents reading this: §0-7 is context, §8 is the work, §10-12 is reference. Update §13 as you go.*
