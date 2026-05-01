---
paths:
  - 'src/routes/**'
  - 'src/services/**'
---

# Nomad API — Endpoint Specifications

## All Endpoints

| Method | Path | Auth | Request Body | Response | Status |
|--------|------|------|-------------|----------|--------|
| `GET` | `/health` | No | — | `{ status, timestamp }` | 200 |
| `GET` | `/api/v1/auth/me` | Yes | — | `{ profile }` | 200/404 |
| `GET` | `/api/v1/profile` | Yes | — | `{ profile }` | 200/404 |
| `PATCH` | `/api/v1/profile` | Yes | `{ display_name?, avatar_url? }` | `{ profile }` | 200/404 |
| `POST` | `/api/v1/trips` | Yes | `CreateTripBody` (see below) | `{ trip, research_job }` | 201 |
| `GET` | `/api/v1/trips` | Yes | `?status=` query param | `{ trips }` | 200 |
| `GET` | `/api/v1/trips/:id` | Yes | — | `{ trip }` | 200/404 |
| `GET` | `/api/v1/trips/:id/full` | Yes | — | `{ trip, days[] }` | 200/404 |
| `PATCH` | `/api/v1/trips/:id` | Yes | `{ status?, emoji? }` | `{ trip }` | 200/404 |
| `DELETE` | `/api/v1/trips/:id` | Yes | — | `{ deleted: true }` | 200/404 |
| `GET` | `/api/v1/trips/:id/research` | Yes | — | `ResearchJobResponse` | 200/404 |
| `GET` | `/api/v1/trending` | No | — | `{ destinations }` | 200 |
| `GET` | `/api/v1/insights` | No | — | `{ insights }` | 200 |

## Request Schemas

### CreateTripBody (POST /trips)
```typescript
{
  destination: string;            // required, min 1 char
  date_from?: string | null;      // ISO date
  date_to?: string | null;        // ISO date
  duration_days?: number;
  travelers?: '1' | '2' | '3+' | 'large';
  vibes?: string[];               // e.g. ['Photo spots', 'Street food']
  accommodation?: 'Boutique Villa' | 'Luxury Hotel' | 'Eco Lodge' | 'Homestay' | 'Airbnb' | 'Hostel' | 'Custom Stay';
  pace?: 'Slow & Soulful' | 'Balanced' | 'Action-Packed';
  budget?: '$' | '$$' | '$$$' | '$$$$';
  preferences?: string;           // free-text
}
```

## Response Shapes

### ResearchJobResponse (GET /trips/:id/research)
```typescript
{
  status: 'pending' | 'researching' | 'building' | 'completed' | 'failed';
  phase: number;             // 0-5
  progress: number;          // 0-100
  message: string;           // e.g. "SCANNING YOUTUBE VLOGS..."
  stats: { places: number; tips: number; photoStops: number };
  discoveries: Array<{
    id: string;
    title: string;
    body: string;
    tags: string[];
    source: 'youtube' | 'reddit' | 'blog' | 'maps';
  }>;
}
```

### TripFull (GET /trips/:id/full)
```typescript
{
  trip: { id, destination, status, statsPlaces, statsTips, statsPhotoStops, emoji, ... };
  days: Array<{
    id, dayNumber, city, title, description, highlights, stopCount,
    stops: Array<{
      id, sortOrder, time, ampm, duration, name, description, source, tags, locked
    }>
  }>;
}
```

## Auth Flow

1. Client sends `Authorization: Bearer <supabase_jwt>` header
2. `authMiddleware` verifies JWT using `SUPABASE_JWT_SECRET`
3. Extracts `userId` from `payload.sub`, attaches to `req.userId`
4. Returns 401 if missing or invalid

## Error Format

All errors follow: `{ error: "Human-readable message" }`
