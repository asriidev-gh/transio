import type { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { getSupabaseConfigStatus, getSupabaseServiceClient } from '../../lib/supabase.js';

/** Statuses that only exist while a background job is running. */
const IN_PROGRESS_STATUSES = ['transcribing', 'summarizing'];
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Background jobs live in this process. A deploy or crash leaves rows stuck in an
 * in-progress status and the app polls forever, so mark long-stale rows as failed.
 */
export async function failStaleSessions(
  client: SupabaseClient,
  staleMinutes: number,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - staleMinutes * 60_000).toISOString();
  const { data, error } = await client
    .from('sessions')
    .update({ status: 'failed' })
    .in('status', IN_PROGRESS_STATUSES)
    .lt('updated_at', cutoff)
    .select('id');

  if (error) {
    throw new Error(`Stale session sweep failed: ${error.message}`);
  }
  return data?.length ?? 0;
}

/** Sweep now and every few minutes. Returns a stop function. No-op without the service role key. */
export function startStaleSessionSweeper(): () => void {
  if (!getSupabaseConfigStatus().hasServiceRole) {
    logger.warn('Stale session sweeper disabled: service role key not configured');
    return () => undefined;
  }

  const sweep = async () => {
    try {
      const count = await failStaleSessions(
        getSupabaseServiceClient(),
        getEnv().JOB_STALE_MINUTES,
      );
      if (count > 0) logger.warn('Marked stuck sessions as failed', { count });
    } catch (err) {
      logger.error('Stale session sweep error', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  void sweep();
  const timer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
