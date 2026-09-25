import { apiError } from '@sessionai/shared';
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const TEN_MINUTES = 10 * 60 * 1000;

type Category = 'heavy' | 'chat' | 'live';

/**
 * Per-user limits by cost. Heavy routes start paid transcription or summary work,
 * chat routes are one short model call, live routes fire every few seconds while recording.
 */
const LIMITS: Record<Category, { limit: number; message: string }> = {
  heavy: { limit: 20, message: 'Too many uploads or processing requests. Please wait a few minutes.' },
  chat: { limit: 120, message: 'Too many requests. Please slow down for a moment.' },
  live: { limit: 600, message: 'Too many live updates. Please slow down for a moment.' },
};

/** Which cost bucket a request falls into. Paths are relative to the router mount. */
export function classifyRequest(method: string, path: string): Category | null {
  if (method !== 'POST') return null;
  if (path === '/voice') return 'chat';
  if (/^\/[^/]+\/(process|transcribe|summarize|audio|import-url)$/.test(path)) return 'heavy';
  if (/^\/[^/]+\/(ask|translate|notes\/finalize)$/.test(path)) return 'chat';
  if (/^\/[^/]+\/(notes-live|translate-live)$/.test(path)) return 'live';
  return null;
}

function userKey(req: Request): string {
  return req.user?.id ?? ipKeyGenerator(req.ip ?? '');
}

function buildLimiter(category: Category): RequestHandler {
  const { limit, message } = LIMITS[category];
  return rateLimit({
    windowMs: TEN_MINUTES,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: userKey,
    handler: (_req, res) => {
      res.status(429).json(apiError('RATE_LIMITED', message));
    },
  });
}

/**
 * Per-user rate limit. Mount after authentication so `req.user` is set,
 * and keep it per user so users behind one carrier IP do not share a budget.
 */
export function userRateLimit(): RequestHandler {
  const limiters: Record<Category, RequestHandler> = {
    heavy: buildLimiter('heavy'),
    chat: buildLimiter('chat'),
    live: buildLimiter('live'),
  };

  return (req, res, next) => {
    const category = classifyRequest(req.method, req.path);
    if (!category) {
      next();
      return;
    }
    limiters[category](req, res, next);
  };
}

/** Broad per-IP flood guard. Generous because mobile carriers share IPs across many users. */
export function ipRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    handler: (_req, res) => {
      res.status(429).json(apiError('RATE_LIMITED', 'Too many requests. Please try again shortly.'));
    },
  });
}
