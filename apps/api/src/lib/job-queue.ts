import { getEnv } from './env.js';
import { logger } from './logger.js';

interface Job {
  name: string;
  run: () => Promise<unknown>;
}

const pending: Job[] = [];
let running = 0;
let stopped = false;
let idleWaiters: Array<() => void> = [];

function concurrencyLimit(): number {
  return Math.max(1, getEnv().JOB_CONCURRENCY);
}

function notifyIfIdle(): void {
  if (running === 0 && (pending.length === 0 || stopped)) {
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const wake of waiters) wake();
  }
}

function pump(): void {
  while (!stopped && running < concurrencyLimit() && pending.length > 0) {
    const job = pending.shift();
    if (!job) break;
    running += 1;
    Promise.resolve()
      .then(job.run)
      .catch((err: unknown) => {
        logger.error('Background job crashed', {
          job: job.name,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      })
      .finally(() => {
        running -= 1;
        pump();
        notifyIfIdle();
      });
  }
}

/**
 * Run a background job with a process-wide concurrency cap.
 * Keeps memory bounded on small hosts and lets shutdown wait for in-flight work.
 */
export function enqueueJob(name: string, run: () => Promise<unknown>): void {
  if (stopped) {
    logger.warn('Job rejected: server is shutting down', { job: name });
    return;
  }
  pending.push({ name, run });
  pump();
}

export function jobStats(): { running: number; queued: number } {
  return { running, queued: pending.length };
}

/** Stop starting new jobs and wait (up to timeoutMs) for running ones. True if idle. */
export async function drainJobs(timeoutMs: number): Promise<boolean> {
  stopped = true;
  if (running === 0) return true;
  return await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    idleWaiters.push(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

/** Tests only. */
export function resetJobQueueForTests(): void {
  pending.length = 0;
  running = 0;
  stopped = false;
  idleWaiters = [];
}
