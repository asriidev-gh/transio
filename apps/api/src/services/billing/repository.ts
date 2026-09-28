import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../lib/logger.js';
import type { SubscriptionUpdate } from './revenuecat.js';

/** Postgres foreign key violation: the user no longer exists, for example after account deletion. */
const FOREIGN_KEY_VIOLATION = '23503';

export type SubscriptionApplier = (update: SubscriptionUpdate) => Promise<boolean>;

/**
 * Store a subscription update. Returns true when written, false when skipped because a newer
 * event was already applied or the user no longer exists. Other database errors are thrown so
 * the webhook answers 500 and RevenueCat retries.
 */
export function createSupabaseSubscriptionApplier(client: SupabaseClient): SubscriptionApplier {
  return async (update) => {
    const { data, error } = await client.rpc('apply_subscription_event', {
      p_user_id: update.userId,
      p_is_active: update.isActive,
      p_plan_id: update.planId,
      p_expires_at: update.expiresAt,
      p_environment: update.environment,
      p_event_ms: update.eventMs,
    });

    if (error) {
      if (error.code === FOREIGN_KEY_VIOLATION) {
        logger.warn('Subscription event for an unknown user was skipped');
        return false;
      }
      throw new Error(`apply_subscription_event failed: ${error.message}`);
    }
    return data === true;
  };
}

/** The stored subscription for a user, without the event bookkeeping. */
export type StoredSubscription = Pick<
  SubscriptionUpdate,
  'isActive' | 'planId' | 'expiresAt' | 'environment'
>;

export type SubscriptionReader = (userId: string) => Promise<StoredSubscription | null>;

/** Read a user's subscription row. Errors are thrown so the webhook answers 500 and is retried. */
export function createSupabaseSubscriptionReader(client: SupabaseClient): SubscriptionReader {
  return async (userId) => {
    const { data, error } = await client
      .from('subscriptions')
      .select('is_active, plan_id, expires_at, environment')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`subscription lookup failed: ${error.message}`);
    if (!data) return null;
    return {
      isActive: data.is_active === true,
      planId: (data.plan_id as string | null) ?? null,
      expiresAt: (data.expires_at as string | null) ?? null,
      environment: (data.environment as string | null) ?? null,
    };
  };
}
