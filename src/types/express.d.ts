declare namespace Express {
  interface Request {
    userId?: string;
    jwtPayload?: import('jsonwebtoken').JwtPayload;
  }
}
