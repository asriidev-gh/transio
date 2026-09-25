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
