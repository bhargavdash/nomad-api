# Skill: Add a New API Route

Use this workflow when adding a new endpoint to the nomad-api.

## Steps

### 1. Define validation schema

If the endpoint accepts a request body, create a Zod schema in the route file:

```typescript
import { z } from 'zod';

const mySchema = z.object({
  field: z.string().min(1),
  optional: z.number().optional(),
});
```

### 2. Create or update service function

Add the business logic in `src/services/`. Use Prisma client:

```typescript
import { prisma } from '../db/client.js';

export async function myFunction(userId: string, data: MyInput) {
  return prisma.myModel.create({ data: { ...data, userId } });
}
```

- Use `findFirst` with `{ id, userId }` for ownership checks
- Use `include` for related data instead of separate queries
- Return `null` for not-found cases

### 3. Add route handler

Create or update a file in `src/routes/`:

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as myService from '../services/my.service.js';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
  const parsed = mySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const result = await myService.myFunction(req.userId!, parsed.data);
  res.status(201).json({ result });
});

export default router;
```

### 4. Wire into Express app

In `src/index.ts`, import and mount the router:

```typescript
import myRoutes from './routes/my.js';
app.use('/api/v1/my-resource', myRoutes);
```

### 5. Update documentation

Add the new endpoint to `.claude/rules/api-specs.md` endpoint table.

## Checklist

- [ ] Zod validation for request body (if applicable)
- [ ] Service function with Prisma queries
- [ ] Route handler with auth middleware (if needed)
- [ ] Mounted in `src/index.ts`
- [ ] Returns correct status codes (200/201/400/401/404)
- [ ] Response wrapped in `{ resource: data }` format
- [ ] `api-specs.md` updated
