import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Prisma database connection
  DATABASE_URL: z.string().min(1),

  // Optional — needed if we initialize a Supabase client server-side (Phase 2: storage, realtime, admin ops)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(), // sb_secret_... (replaces legacy service_role JWT)

  // nomad-agent (Python FastAPI + LangGraph) integration — see FRONTEND_INTEGRATION_PLAN.md
  // Base URL of the agent service. In dev, defaults to http://localhost:8001.
  // In prod, set to the deployed agent service URL (Render / Cloud Run).
  AGENT_SERVICE_URL: z.string().url(),
  // Shared secret used to authenticate Node → Python calls. Must byte-match
  // nomad-agent/.env INTERNAL_AGENT_SECRET; mismatch results in 401 + failed trip.
  INTERNAL_AGENT_SECRET: z.string().min(16),
});

export const env = envSchema.parse(process.env);
