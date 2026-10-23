import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { HttpError } from '../errors';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. Always present afterwards. */
      userId?: number;
    }
  }
}

const TOKEN_TTL = '24h';

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: TOKEN_TTL });
}

/**
 * Guards every /loans route. The token payload carries only the user id
 * (the "sub" claim) - no phone number, no role, nothing to tamper with,
 * because JWTs are signed but NOT encrypted.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Missing bearer token', 'NO_TOKEN'));
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    const userId = Number((payload as jwt.JwtPayload).sub);
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('bad subject');
    req.userId = userId;
    next();
  } catch {
    // Deliberately vague: never tell a caller whether the token was malformed,
    // expired or signed with the wrong key.
    next(new HttpError(401, 'Invalid or expired token', 'BAD_TOKEN'));
  }
};
