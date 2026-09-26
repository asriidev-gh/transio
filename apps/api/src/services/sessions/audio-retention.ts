import type { SupabaseClient } from '@supabase/supabase-js';
import { SESSION_AUDIO_BUCKET } from '@sessionai/shared';
import { logger } from '../../lib/logger.js';
import { getSupabaseConfigStatus, getSupabaseServiceClient } from '../../lib/supabase.js';

/** How long stored audio outlives its upload for anyone without an active subscription. */
export const AUDIO_RETENTION_DAYS = 30;

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
/** Keeps one pass bounded; whatever is left over is picked up an hour later. */
const SWEEP_BATCH = 200;

/** When audio uploaded now should be deleted. Null for Pro, which keeps it. */
export function audioExpiryFor(isPro: boolean, now: Date = new Date()): string | null {
  if (isPro) return null;
  return new Date(now.getTime() + AUDIO_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Moves every stored recording a user owns onto the schedule their subscription
 * earns them: no expiry while they are paying, a fresh window from now when they
 * stop. Best-effort — a failure here only means the old dates stand until the
 * next event, so it must never fail the webhook that triggered it.
 */
export async function rescheduleAudioRetention(
  client: SupabaseClient,
  userId: string,
  isPro: boolean,
): Promise<void> {
  const { data, error } = await client.rpc('reschedule_audio_retention', {
    p_user_id: userId,
    p_is_pro: isPro,
    p_retention_days: AUDIO_RETENTION_DAYS,
  });

  if (error) {
    logger.warn('Could not reschedule audio retention', { isPro, message: error.message });
    return;
  }
  if (typeof data === 'number' && data > 0) {
    logger.info('Rescheduled audio retention', { isPro, sessions: data });
  }
}

/**
 * Deletes audio that has passed its expiry and clears the path that pointed at it.
 *
 * Storage is emptied before the row is updated. Doing it the other way round
 * would orphan the object with nothing left to say where it was, and an object
 * that outlives a failed row update is found again on the next pass.
 */
export async function sweepExpiredAudio(
  client: SupabaseClient,
  now: Date = new Date(),
  limit = SWEEP_BATCH,
): Promise<number> {
  const { data, error } = await client
    .from('sessions')
    .select('id, audio_path')
    .not('audio_path', 'is', null)
    .not('audio_expires_at', 'is', null)
    .lt('audio_expires_at', now.toISOString())
    .limit(limit);

  if (error) {
    throw new Error(`Expired audio lookup failed: ${error.message}`);
  }

  const rows = (data ?? []) as { id: string; audio_path: string | null }[];
  if (rows.length === 0) return 0;

  const paths = rows.map((row) => row.audio_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: removeError } = await client.storage.from(SESSION_AUDIO_BUCKET).remove(paths);
    if (removeError) {
      throw new Error(`Expired audio delete failed: ${removeError.message}`);
    }
  }

  const { error: updateError } = await client
    .from('sessions')
    .update({ audio_path: null })
    .in(
      'id',
      rows.map((row) => row.id),
    );

  if (updateError) {
    throw new Error(`Expired audio path clear failed: ${updateError.message}`);
  }

  return rows.length;
}

/** Sweep now and hourly. Returns a stop function. No-op without the service role key. */
export function startAudioRetentionSweeper(): () => void {
  if (!getSupabaseConfigStatus().hasServiceRole) {
    logger.warn('Audio retention sweeper disabled: service role key not configured');
    return () => undefined;
  }

  const sweep = async () => {
    try {
      const count = await sweepExpiredAudio(getSupabaseServiceClient());
      if (count > 0) logger.info('Deleted expired session audio', { count });
    } catch (err) {
      logger.error('Audio retention sweep error', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  void sweep();
  const timer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
