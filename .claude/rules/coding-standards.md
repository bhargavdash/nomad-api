# Nomad API — Coding Standards

> Always-loaded rules that apply to every conversation.

## TypeScript

1. **Strict mode** — `strict: true` in tsconfig. No `any` unless unavoidable.
2. **Module resolution** — NodeNext. Use `.js` extensions in all imports (e.g., `'./client.js'`).
3. **Naming** — `camelCase` for variables/functions, `PascalCase` for types/interfaces/classes.
4. **Prefer `const`** over `let`. Never use `var`.

## Express

1. **Express v5** — async route handlers auto-catch rejected promises. No wrapper needed.
2. **Auth** — use `authMiddleware` from `src/middleware/auth.ts`. Attaches `req.userId` (string).
3. **Error handler** — centralized in `src/middleware/error.ts`. Routes should throw or return error responses directly.
4. **Route params** — Express v5 `req.params` can return `string | string[]`. Use `paramStr()` helper to extract safely.

## Prisma

1. **`findUnique`** for queries on unique/PK fields. **`findFirst`** for compound non-unique conditions.
2. **Always null-check** results from `findUnique`/`findFirst` before proceeding.
3. **Use `include`** for relations instead of separate queries: `prisma.trip.findFirst({ include: { days: { include: { stops: true } } } })`.
4. **Ownership checks** — always verify `userId` match before `update`/`delete`. Prisma's `update`/`delete` require a unique `where`; use `findFirst` to check ownership, then mutate by `id`.
5. **`@updatedAt`** — Prisma auto-sets `updatedAt` on `.update()` calls. Don't set it manually.
6. **Schema changes** — edit `prisma/schema.prisma`, run `npx prisma db push` (dev) or `npx prisma migrate dev` (production).

## API Response Format

1. **Success responses** — always wrap in `{ resource: data }`: `{ trip }`, `{ trips }`, `{ profile }`, `{ destinations }`, `{ insights }`.
2. **Error responses** — always `{ error: "message" }`.
3. **Status codes** — 200 (success), 201 (created), 400 (validation), 401 (unauthorized), 404 (not found), 500 (server error).

## Validation

1. **Zod schemas** at route level for request body validation.
2. **`safeParse`** pattern — return 400 with `error.flatten()` on failure.
3. **Query params** — cast with `as string | undefined`, no Zod needed for simple filters.

## Code Style

1. **Prettier** enforced via pre-commit hook: `singleQuote`, `trailingComma: "all"`, `printWidth: 100`.
2. **ESLint** — flat config with typescript-eslint. Run `npm run lint` to check.
3. **Commits** — conventional commits enforced by commitlint (`feat:`, `fix:`, `chore:`, etc.).
4. **No dead code** — delete unused imports, functions, and variables. Don't comment them out.
