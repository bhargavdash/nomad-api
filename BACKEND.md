# Nomad API — Backend Architecture

## Auth Strategy: Supabase JWT

The mobile app handles login via Supabase (Google OAuth, email/password).
After login, the client receives a Supabase JWT and sends it as `Authorization: Bearer <token>` on every request.
The backend verifies the JWT signature using `SUPABASE_JWT_SECRET` — it never contacts Supabase at runtime.

### One-time setup
1. Create a Supabase project at supabase.com
2. Fill `.env` with your project credentials (see Environment section below)
3. `npm run db:push` — creates all tables
4. `npm run db:seed` — seeds trending destinations + insights
5. After first login on mobile, call `POST /api/v1/auth/sync` to create the user's Profile row

---

## Endpoints

### Auth

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | /api/v1/auth/sync | Yes | ✅ Done |
| GET | /api/v1/auth/me | Yes | ✅ Done |

**POST /api/v1/auth/sync**
Call once after Supabase login. Reads name + avatar from JWT claims and upserts the Profile row.
No body needed — everything comes from the verified token.
```
Response: { profile }
```

**GET /api/v1/auth/me**
Returns the authenticated user's profile.
```
Response: { profile }
```

---

### Profile

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | /api/v1/profile | Yes | ✅ Done |
| PATCH | /api/v1/profile | Yes | ✅ Done |

**PATCH /api/v1/profile**
```
Body:     { display_name?: string, avatar_url?: string }
Response: { profile }
```

---

### Trips

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | /api/v1/trips | Yes | ✅ Done |
| GET | /api/v1/trips | Yes | ✅ Done |
| GET | /api/v1/trips/:id | Yes | ✅ Done |
| GET | /api/v1/trips/:id/full | Yes | ✅ Done |
| PATCH | /api/v1/trips/:id | Yes | ✅ Done |
| DELETE | /api/v1/trips/:id | Yes | ✅ Done |

**POST /api/v1/trips** — Submits the PlanTrip form, creates a Trip + ResearchJob, starts the AI worker.
```
Body: {
  destination:   string          // required — "Rajasthan, India"
  date_from?:    string          // ISO date — "2026-03-28"
  date_to?:      string          // ISO date — "2026-04-04"
  duration_days?: number
  travelers?:    "1" | "2" | "3+" | "large"
  vibes?:        string[]        // ["Photo spots", "Street food"]
  accommodation?: "Boutique Villa" | "Luxury Hotel" | "Eco Lodge"
                | "Homestay" | "Airbnb" | "Hostel" | "Custom Stay"
  pace?:         "Slow & Soulful" | "Balanced" | "Action-Packed"
  budget?:       "$" | "$$" | "$$$" | "$$$$"
  preferences?:  string          // free-text
}
Response: { trip, research_job }
```

**GET /api/v1/trips?status=** — List user's trips. Optional `?status=ready|researching|active`.
```
Response: { trips: Trip[] }
```

**GET /api/v1/trips/:id/full** — Full itinerary with days and stops (used by ItineraryReveal screen).
```
Response: { trip, days: ItineraryDay[] }  // each day includes stops[]
```

**PATCH /api/v1/trips/:id**
```
Body:     { status?: string, emoji?: string }
Response: { trip }
```

---

### Research Polling

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | /api/v1/trips/:id/research | Yes | ✅ Done |

**GET /api/v1/trips/:id/research** — Poll while ResearchTicker screen is showing (every ~1-2s).
```
Response: {
  status:      "pending" | "researching" | "building" | "completed" | "failed"
  phase:       number        // 0–5
  progress:    number        // 0–100
  message:     string        // "SCANNING YOUTUBE VLOGS..."
  stats:       { places: number, tips: number, photoStops: number }
  discoveries: { id, title, body, tags, source }[]
}
```
When `status === "completed"`, navigate to ItineraryReveal and call `GET /trips/:id/full`.

---

### Stop Management

| Method | Path | Auth | Status |
|--------|------|------|--------|
| PATCH | /api/v1/trips/:id/stops/:stopId | Yes | ✅ Done |
| DELETE | /api/v1/trips/:id/stops/:stopId | Yes | ✅ Done |

**PATCH /api/v1/trips/:id/stops/:stopId** — Lock/unlock or edit a stop (used in ItineraryReveal).
```
Body:     { locked?: boolean, name?: string, description?: string, time?: string, ampm?: string }
Response: { stop }
```

**DELETE /api/v1/trips/:id/stops/:stopId**
```
Response: { deleted: true }
```

---

### Feed (public, no auth)

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | /api/v1/trending | No | ✅ Done |
| GET | /api/v1/insights | No | ✅ Done |

**GET /api/v1/trending** — Home screen destination carousel.
```
Response: { destinations: TrendingDestination[] }
```

**GET /api/v1/insights** — Home screen insights feed.
```
Response: { insights: Insight[] }
```

---

## Phase 2 Endpoints (not yet built)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/trips/:id/stops | Add a custom stop to any day |
| GET | /api/v1/trips/:id/today | InTripCompanion — today's day + stops |
| PATCH | /api/v1/trips/:id/stops/:stopId/reorder | Drag-to-reorder stops |

---

## Data Models

### Trip
```typescript
{
  id:              string
  destination:     string
  dateFrom:        string | null
  dateTo:          string | null
  durationDays:    number | null
  travelers:       string | null
  vibes:           string[]
  accommodation:   string | null
  pace:            string | null
  budget:          string | null
  preferences:     string | null
  status:          "researching" | "ready" | "active" | "completed" | "archived"
  statsPlaces:     number
  statsTips:       number
  statsPhotoStops: number
  emoji:           string | null
  createdAt:       string
  updatedAt:       string
}
```

### ItineraryDay (inside /full response)
```typescript
{
  id:          string
  dayNumber:   number
  city:        string
  title:       string
  description: string | null
  highlights:  string[]
  stopCount:   number
  stops:       Stop[]
}
```

### Stop
```typescript
{
  id:          string
  sortOrder:   number
  time:        string        // "7:00"
  ampm:        "AM" | "PM"
  duration:    string        // "2 hrs"
  name:        string
  description: string | null
  source:      "youtube" | "reddit" | "blog" | "maps"
  tags:        string[]
  locked:      boolean
}
```

### Profile
```typescript
{
  id:          string    // = Supabase auth.users UUID
  email:       string | null
  displayName: string | null
  avatarUrl:   string | null
  createdAt:   string
  updatedAt:   string
}
```

---

## Implementation Phases

### Phase 1 — MVP (current)
- [x] All trip CRUD endpoints
- [x] Research polling with mock AI worker
- [x] Trending + insights feed
- [x] JWT auth middleware
- [x] POST /auth/sync — profile upsert on first login
- [x] PATCH/DELETE /trips/:id/stops/:stopId
- [ ] Connect real Supabase credentials + run migrations

### Phase 2 — Real AI
- [ ] Claude API itinerary generation (replace mock worker)
- [ ] BullMQ + Redis job queue (replace setTimeout)
- [ ] Full stop data for all 7 days (currently only Day 1)
- [ ] POST /trips/:id/stops (add custom stop)
- [ ] InTripCompanion endpoints (`/today`)

---

## Environment

Copy `.env.example` → `.env` and fill in:

```
PORT=3000
NODE_ENV=development

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=<Dashboard → Settings → API → JWT Secret>

DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

```bash
npm run db:push    # push schema to Supabase Postgres
npm run db:seed    # seed trending destinations + insights
npm run dev        # start dev server on PORT (default 3000)
```
