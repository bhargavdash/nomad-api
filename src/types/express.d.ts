declare namespace Express {
  interface Request {
    userId?: string;
    jwtPayload?: import('jose').JWTPayload;
  }
}
