---
paths:
  - 'prisma/**'
  - 'src/services/**'
---

# Nomad API — Database Schema

## Entity Relationship

```
Profile 1──N Trip 1──N ItineraryDay 1──N Stop
                 └──1 ResearchJob (unique per trip)

TrendingDestination (standalone, admin-seeded)
Insight (standalone, admin-seeded)
```

## Models

### Profile
| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | From Supabase `auth.users` |
| displayName | String? | Google profile name |
| avatarUrl | String? | Google avatar |
| email | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | Auto-set by Prisma |

Created by Supabase DB trigger on user signup.

### Trip
| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Auto-generated |
| userId | UUID FK → Profile | Cascade delete |
| destination | String | e.g. "Rajasthan, India" |
| dateFrom/dateTo | String? | Date strings |
| durationDays | Int? | |
| travelers | String? | '1', '2', '3+', 'large' |
| vibes | String[] | Selected keywords |
| accommodation | String? | One of 7 options |
| pace | String? | 'Slow & Soulful' / 'Balanced' / 'Action-Packed' |
| budget | String? | '$' / '$$' / '$$$' / '$$$$' |
| preferences | String? | Free-text |
| status | String | 'researching' / 'ready' / 'active' / 'completed' / 'archived' |
| statsPlaces/statsTips/statsPhotoStops | Int | Denormalized counts |
| emoji | String? | Destination emoji |

### ItineraryDay
| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| tripId | UUID FK → Trip | Cascade delete |
| dayNumber | Int | 1, 2, 3... |
| city | String | e.g. "Jaipur" |
| title | String | e.g. "The Pink City" |
| description | String? | Day summary |
| highlights | String[] | Key attractions |
| stopCount | Int | Denormalized |

**Unique constraint**: `(tripId, dayNumber)`

### Stop
| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| dayId | UUID FK → ItineraryDay | Cascade |
| tripId | UUID FK → Trip | For direct queries |
| sortOrder | Int | Position in day |
| time | String | "7:00" |
| ampm | String | 'AM' / 'PM' |
| duration | String | "2 hrs" |
| name | String | |
| description | String? | |
| source | String | 'youtube' / 'reddit' / 'blog' / 'maps' |
| tags | String[] | |
| locked | Boolean | Default false |

### ResearchJob
| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| tripId | UUID FK UNIQUE → Trip | One job per trip |
| status | String | 'pending' / 'researching' / 'building' / 'completed' / 'failed' |
| phase | Int | 0-5 |
| progress | Int | 0-100 |
| message | String? | Status message |
| stats* | Int | Running discovery counts |
| discoveries | Json | Array of discovery cards |
| error | String? | Error message if failed |
| startedAt/completedAt | DateTime? | |

### TrendingDestination + Insight
Admin-seeded reference tables. See `prisma/seed.ts` for data.

## Conventions

- **UUIDs**: `gen_random_uuid()` via Postgres, not application-generated
- **Cascade deletes**: Deleting a Profile cascades to all Trips, which cascade to Days/Stops/ResearchJobs
- **Snake case in DB**: All table/column names use snake_case via `@@map()` / `@map()`
- **CamelCase in code**: Prisma models use camelCase fields
- **Seeding**: `npm run db:seed` runs `prisma/seed.ts` — deletes then recreates trending + insights
