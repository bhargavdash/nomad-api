import { env } from './env.js';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/error.js';
import { recoverStaleJobs } from './services/research.service.js';

// Routes
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import tripRoutes from './routes/trips.js';
import researchRoutes from './routes/research.js';
import feedRoutes from './routes/feed.js';

const app = express();

// Required for Railway (and any reverse-proxy deployment): tells Express to
// trust the X-Forwarded-For header so req.ip resolves to the real client IP.
// Without this, every request looks like it comes from the proxy's internal IP
// and all users share one rate-limit bucket — a single research session can
// exhaust the global limit for everyone.
app.set('trust proxy', 1);

// CORS — only allow the web frontends (React Native is not a browser; it ignores CORS)
app.use(
  cors({
    origin: ['https://nomad-web-ten.vercel.app', 'http://localhost:3000'],
    credentials: true,
  }),
);

// Rate limiting — protects free-tier LLM/API quotas from abuse.
// 600 req / 15 min per real IP (~40 req/min sustained). Covers one active
// research session (30 req/min polling) with comfortable headroom for other
// API calls running concurrently.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

app.use(globalLimiter);
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/trips', researchRoutes); // /trips/:id/research
app.use('/api/v1', feedRoutes); // /trending

// Error handler
app.use(errorHandler);

// Recover any jobs that were in-flight when the server last died
recoverStaleJobs().catch((err) => {
  console.error('[nomad-api] Failed to recover stale research jobs:', err);
});

const server = app.listen(env.PORT, () => {
  console.log(`[nomad-api] Server running on http://localhost:${env.PORT}`);
  console.log(`[nomad-api] Environment: ${env.NODE_ENV}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[nomad-api] Port ${env.PORT} is already in use. Kill the process using it and retry.`,
    );
  } else {
    console.error('[nomad-api] Server error:', err.message);
  }
  process.exit(1);
});
