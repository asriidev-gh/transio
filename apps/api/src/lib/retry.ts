import { AppError } from '../middleware/error-handler.js';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAppError(err: unknown): boolean {
  if (!(err instanceof AppError)) return false;
  // Only retry transient upstream failures — never 4xx validation / bad audio.
  return err.statusCode === 429 || err.statusCode === 502 || err.statusCode === 503;
}

/**
 * Retries an async operation on transient provider failures (429/502/503).
 */
export async function withProviderRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: { retries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 800;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !isRetryableAppError(err)) {
        throw err;
      }
      const delay = baseDelayMs * 2 ** attempt;
      await sleep(delay);
    }
  }

  throw lastError;
}
