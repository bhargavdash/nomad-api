# Nomad API — Claude Code Development Guide

## What this service is

Express + TypeScript REST API backend for the Nomad mobile travel planning app. Handles authentication, trip planning, AI-powered itinerary generation, and content feeds.

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20+ / TypeScript (strict, NodeNext) |
| Framework | Express v5 |
| ORM | Prisma (PostgreSQL) |
| Database | Supabase Postgres |
| Auth | Supabase Auth — JWT verification server-side |
| Validation | Zod |
| AI | Mock service (Phase 1) → Claude API via Anthropic SDK (Phase 2) |
| Dev tools | ESLint, Prettier, Husky, commitlint, lint-staged |

## API structure

Base URL: `/api/v1`

| Group | Routes | Auth |
|-------|--------|------|
| Auth | `GET /auth/me` | Yes |
| Profile | `GET /profile`, `PATCH /profile` | Yes |
| Trips | `POST /trips`, `GET /trips`, `GET /trips/:id`, `GET /trips/:id/full`, `PATCH /trips/:id`, `DELETE /trips/:id` | Yes |
| Research | `GET /trips/:id/research` | Yes |
| Feed | `GET /trending`, `GET /insights` | No |

## Database (7 Prisma models)

```
Profile 1──N Trip 1──N ItineraryDay 1──N Stop
                 └──1 ResearchJob

TrendingDestination (standalone, seeded)
Insight (standalone, seeded)
```

- All PKs: UUID via `gen_random_uuid()`
- Cascade deletes: Profile → Trip → ItineraryDay/Stop/ResearchJob
- Schema: `prisma/schema.prisma`
- Seed: `prisma/seed.ts` (run via `npm run db:seed`)

## Key decisions

- **Supabase Auth**: Mobile app handles OAuth flow client-side. Backend verifies Supabase JWT via `SUPABASE_JWT_SECRET`. Profile created by DB trigger on signup.
- **Prisma ORM**: Type-safe queries, relation includes, automatic `@updatedAt`.
- **Mock AI first**: Research worker uses `setTimeout` phases to simulate AI generation. Returns hardcoded Rajasthan itinerary. Real Claude API integration is Phase 2.
- **Express v5**: Native async error handling — no need for `express-async-errors`.
- **Ownership checks**: `findFirst({ where: { id, userId } })` before update/delete to ensure users only access their own trips.

## Project structure

```
nomad-api/
├── prisma/
│   ├── schema.prisma          # Database models
│   └── seed.ts                # Seed trending + insights
├── src/
│   ├── index.ts               # Express app entry + route mounting
│   ├── env.ts                 # Zod environment validation
│   ├── db/
│   │   └── client.ts          # PrismaClient singleton
│   ├── middleware/
│   │   ├── auth.ts            # Supabase JWT verification
│   │   └── error.ts           # Global error handler
│   ├── routes/
│   │   ├── auth.ts            # /auth/*
│   │   ├── profile.ts         # /profile
│   │   ├── trips.ts           # /trips/*
│   │   ├── research.ts        # /trips/:id/research
│   │   └── feed.ts            # /trending, /insights
│   ├── services/
│   │   ├── trip.service.ts    # Trip CRUD logic
│   │   ├── research.service.ts # Research job queries
│   │   └── ai.service.ts     # Mock AI data (Phase 1)
│   ├── workers/
│   │   └── research.worker.ts # Async mock research
│   └── types/
│       ├── index.ts           # Shared types
│       └── express.d.ts       # Express Request augmentation
├── .claude/                   # Claude Code config
│   ├── CLAUDE.md              # ← you are here
│   ├── rules/
│   │   ├── coding-standards.md
│   │   ├── api-specs.md
│   │   └── database-schema.md
│   └── skills/
│       ├── add-route.md
│       └── add-ai-agent.md
├── eslint.config.mjs
├── .prettierrc
├── commitlint.config.cjs
├── tsconfig.json
├── package.json
└── .env.example
```

## Development priorities

### Phase 1 — MVP (current)
- Mock AI research worker (hardcoded itinerary)
- All CRUD endpoints for trips
- Supabase JWT auth middleware
- Seeded trending destinations + insights feed

### Phase 2 — AI + Polish
- Real Claude API integration (Anthropic SDK)
- BullMQ + Redis for job queues
- Stop manipulation endpoints (lock/swap/move/delete)
- InTripCompanion endpoints
- Rate limiting, caching, image integration

## Reference priority

`api-specs.md` > `database-schema.md` > this file

## Rule file map

| File | Scope | Contents |
|------|-------|----------|
| `rules/coding-standards.md` | All paths | TypeScript, Express, Prisma conventions |
| `rules/api-specs.md` | `src/routes/**`, `src/services/**` | Endpoint definitions, request/response shapes |
| `rules/database-schema.md` | `prisma/**`, `src/services/**` | Models, relationships, constraints |

## Scripts

| Script | Command |
|--------|---------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | TypeScript compile |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Create/run migration |
| `npm run db:push` | Push schema to DB |
| `npm run db:seed` | Seed reference data |
