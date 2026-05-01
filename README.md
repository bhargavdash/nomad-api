# Nomad API

REST API backend for the Nomad travel planning mobile app. Handles authentication, trip planning, AI-powered itinerary generation, and content feeds.

## Tech Stack

- **Runtime:** Node.js 20+ / TypeScript
- **Framework:** Express v5
- **ORM:** Prisma (PostgreSQL)
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth (JWT verification)
- **Validation:** Zod

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project (for database + auth)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your Supabase credentials in .env

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed reference data
npm run db:seed

# Start development server
npm run dev
```

The server runs at `http://localhost:3000`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `GET` | `/api/v1/auth/me` | Yes | Current user profile |
| `GET` | `/api/v1/profile` | Yes | Get profile |
| `PATCH` | `/api/v1/profile` | Yes | Update profile |
| `POST` | `/api/v1/trips` | Yes | Create trip + start AI research |
| `GET` | `/api/v1/trips` | Yes | List user's trips |
| `GET` | `/api/v1/trips/:id` | Yes | Get trip summary |
| `GET` | `/api/v1/trips/:id/full` | Yes | Get trip with itinerary |
| `PATCH` | `/api/v1/trips/:id` | Yes | Update trip |
| `DELETE` | `/api/v1/trips/:id` | Yes | Delete trip |
| `GET` | `/api/v1/trips/:id/research` | Yes | Poll research progress |
| `GET` | `/api/v1/trending` | No | Trending destinations |
| `GET` | `/api/v1/insights` | No | Travel insights feed |

Auth endpoints require `Authorization: Bearer <supabase_jwt>` header.

## Project Structure

```
nomad-api/
├── prisma/
│   ├── schema.prisma       # Database models (7 tables)
│   └── seed.ts             # Seed trending + insights
├── src/
│   ├── index.ts            # Express app entry
│   ├── env.ts              # Environment validation
│   ├── db/client.ts        # Prisma client
│   ├── middleware/          # Auth + error handling
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic + AI mock
│   ├── workers/            # Background research worker
│   └── types/              # Shared TypeScript types
├── eslint.config.mjs
├── .prettierrc
├── commitlint.config.cjs
└── tsconfig.json
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (hot reload) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled output |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed reference data |

## Environment Variables

See `.env.example` for required variables:

- `PORT` — Server port (default: 3000)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `SUPABASE_JWT_SECRET` — JWT secret for token verification
- `DATABASE_URL` — Direct Postgres connection string
