# Skill: Add a New AI Agent / Background Worker

Use this workflow when adding a new AI-powered background process (like the research worker that generates itineraries).

## Architecture Pattern

The nomad-api uses an **async job + polling** pattern:
1. Client sends a request → server creates a job record → returns immediately
2. A background worker processes the job (setTimeout in Phase 1, BullMQ in Phase 2)
3. Worker updates the job record with progress as it runs
4. Client polls a status endpoint until the job is complete
5. Client fetches the final result from a separate endpoint

## Steps

### 1. Define types

Add the agent's output types in `src/types/index.ts`:

```typescript
export interface MyAgentResult {
  // fields the agent produces
}

export type MyJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
```

### 2. Add mock data

In `src/services/ai.service.ts`, add mock phases and results:

```typescript
export const MY_AGENT_PHASES = [
  { phase: 1, delay: 0, progress: 25, message: 'STARTING...' },
  { phase: 2, delay: 2000, progress: 50, message: 'PROCESSING...' },
  { phase: 3, delay: 4000, progress: 75, message: 'FINALIZING...' },
  { phase: 4, delay: 6000, progress: 100, message: 'DONE' },
];

export const MY_AGENT_MOCK_RESULT: MyAgentResult = {
  // hardcoded result data
};
```

### 3. Add Prisma model (if needed)

If the agent needs its own job tracking table, add to `prisma/schema.prisma`:

```prisma
model MyJob {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tripId    String   @unique @map("trip_id") @db.Uuid
  status    String   @default("pending")
  progress  Int      @default(0)
  result    Json?
  error     String?
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  trip Trip @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@map("my_jobs")
}
```

Run `npx prisma db push` after schema changes.

### 4. Build the worker

Create `src/workers/my.worker.ts` following the research worker pattern:

```typescript
import { prisma } from '../db/client.js';
import { MY_AGENT_PHASES, MY_AGENT_MOCK_RESULT } from '../services/ai.service.js';

export function startMyWorker(tripId: string): void {
  // Schedule phase updates
  for (const phase of MY_AGENT_PHASES) {
    setTimeout(() => {
      prisma.myJob.update({
        where: { tripId },
        data: { progress: phase.progress, status: 'processing' },
      });
    }, phase.delay);
  }

  // Write final result after all phases
  setTimeout(async () => {
    try {
      await prisma.myJob.update({
        where: { tripId },
        data: { status: 'completed', result: MY_AGENT_MOCK_RESULT },
      });
    } catch (err) {
      await prisma.myJob.update({
        where: { tripId },
        data: { status: 'failed', error: String(err) },
      });
    }
  }, /* total duration */);
}
```

### 5. Create polling endpoint

Add to `src/routes/` — follows the same pattern as `research.ts`:

```typescript
router.get('/:id/my-status', authMiddleware, async (req, res) => {
  // 1. Verify trip ownership
  // 2. Fetch job status
  // 3. Return { status, progress, result? }
});
```

### 6. Integrate trigger

Add the worker kick-off to the relevant route (e.g., trip creation or a new endpoint).

## Phase 2: Real AI

When replacing mock with real Claude API:
1. Install `@anthropic-ai/sdk`
2. Create `src/lib/anthropic.ts` with client setup
3. Replace mock data with `anthropic.messages.create()` using `tool_use` for structured output
4. Keep the same job + polling architecture — just swap the data source

## Checklist

- [ ] Types defined in `src/types/index.ts`
- [ ] Mock data in `src/services/ai.service.ts`
- [ ] Prisma model (if new job table needed)
- [ ] Worker in `src/workers/` with setTimeout phases
- [ ] Polling endpoint in `src/routes/`
- [ ] Trigger wired into creation flow
- [ ] `api-specs.md` updated with new endpoint
