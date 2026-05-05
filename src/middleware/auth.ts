import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

// Supabase JWKS endpoint
const JWKS = createRemoteJWKSet(
  new URL('https://qtqignacbrwhblgjbxat.supabase.co/auth/v1/.well-known/jwks.json'),
);

// Extend Request type if needed
interface AuthenticatedRequest extends Request {
  userId?: string;
  jwtPayload?: JWTPayload;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'https://qtqignacbrwhblgjbxat.supabase.co/auth/v1',
      audience: 'authenticated', // important for Supabase
    });

    req.userId = payload.sub as string;
    req.jwtPayload = payload;

    next();
  } catch (err) {
    console.error('JWT verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
