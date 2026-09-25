import type { NextFunction, Request, Response } from 'express';
import { getSupabaseAnonClient } from '../lib/supabase.js';
import { AppError } from './error-handler.js';

/**
 * Extracts a Bearer token from the Authorization header.
 */
export function parseBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer' || token.trim().length === 0) {
    return null;
  }

  return token.trim();
}

/**
 * Requires a valid Supabase JWT. Attaches `req.user` on success.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
      return;
    }

    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      next(new AppError('UNAUTHORIZED', 'Invalid or expired session', 401));
      return;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email ?? null,
      isAnonymous: data.user.is_anonymous === true,
    };
    req.accessToken = token;

    next();
  } catch (err) {
    if (err instanceof Error && err.message.includes('Supabase is not configured')) {
      next(new AppError('SERVICE_UNAVAILABLE', 'Authentication service is not configured', 503));
      return;
    }
    next(err);
  }
}
