---
name: add-prisma-migration
description: Guide for creating and applying a Prisma migration in nomad-api — schema changes, cascade implications, seed updates, and client regeneration
---

When making a database schema change in nomad-api, follow this sequence exactly.

## Before touching schema.prisma

1. Read the current `prisma/schema.prisma` — understand all relations touching the affected model
2. Read `.claude/rules/database-schema.md` — constraints, cascade rules, UUID defaults
3. Check if any `src/services/*.ts` files query the model being changed — list the affected queries

## Step sequence

```bash
# 1. Edit prisma/schema.prisma with your changes

# 2. Create a named migration (never use --name auto)
npx prisma migrate dev --name <descriptive_name>
# e.g. --name add_budget_to_trips, --name add_companion_table

# 3. Regenerate the Prisma client (migrate dev does this, but confirm)
npx prisma generate

# 4. If you added a new model with seed data, update prisma/seed.ts and re-seed
npm run db:seed
```

## Schema rules

- All PKs: `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`
- Foreign keys: match the PK type (`@db.Uuid`)
- Cascade deletes on child records: `onDelete: Cascade`
- Timestamps on every model: `createdAt DateTime @default(now())` + `updatedAt DateTime @updatedAt`
- No `String` for UUIDs — always `@db.Uuid`
- Enum values in `SCREAMING_SNAKE_CASE`

## Adding a column to an existing model

```prisma
model Trip {
  // existing fields...
  budgetTier   String?   // nullable = safe migration, no default needed
  // OR for required field with default:
  pace         String    @default("MODERATE")
}
```

Required columns without defaults will fail on existing rows — always add a default or make nullable first.

## Adding a new model

1. Define the model in `schema.prisma`
2. Add the relation back-reference on the parent model
3. Confirm cascade delete is set if it's a child entity
4. Add a `create` helper in the appropriate `src/services/*.service.ts`
5. Update `.claude/rules/database-schema.md` to reflect the new model

## Danger zones

- Renaming a column = breaking change for any query using the old name — grep `src/` first
- Removing a column = check services + any select spreads
- Changing a FK relation = check cascade behavior on existing data
- Never run `prisma db push` in production — use `prisma migrate deploy`
