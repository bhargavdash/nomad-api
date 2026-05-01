import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message);

  if (env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(500).json({ error: 'Internal server error' });
}

// Lazy import to avoid circular dependency
import { env } from '../env.js';
