import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Used by authMiddleware to verify Supabase user session JWTs
  SUPABASE_JWT_SECRET: z.string().min(1),

  // Prisma database connection
  DATABASE_URL: z.string().min(1),

  // Optional — needed if we initialize a Supabase client server-side (Phase 2: storage, realtime, admin ops)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(), // sb_secret_... (replaces legacy service_role JWT)
});

export const env = envSchema.parse(process.env);
