import { env } from './env.js';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.js';

// Routes
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import tripRoutes from './routes/trips.js';
import researchRoutes from './routes/research.js';
import feedRoutes from './routes/feed.js';

const app = express();

// Middleware
app.use(cors());
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
app.use('/api/v1', feedRoutes); // /trending, /insights

// Error handler
app.use(errorHandler);

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
