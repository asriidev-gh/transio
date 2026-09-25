import { apiError } from '@sessionai/shared';
import type { RequestHandler } from 'express';
import { getEnv } from '../lib/env.js';

let inflight = 0;

/**
 * Uploads are buffered in memory, so cap how many run at once. Extra requests get a
 * 503 with Retry-After instead of risking an out-of-memory crash on a small host.
 */
export function uploadGate(): RequestHandler {
  return (req, res, next) => {
    if (inflight >= getEnv().MAX_CONCURRENT_UPLOADS) {
      res.setHeader('Retry-After', '15');
      res.setHeader('Connection', 'close');
      res
        .status(503)
        .json(
          apiError(
            'SERVER_BUSY',
            'The server is busy with other uploads. Please try again in a minute.',
          ),
        );
      // Drain the unread body so the client sees this response, not a dropped connection.
      req.resume();
      return;
    }

    inflight += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      inflight -= 1;
    };
    res.on('close', release);
    next();
  };
}

/** Tests only. */
export function uploadsInFlight(): number {
  return inflight;
}
