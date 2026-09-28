import { createHash, timingSafeEqual } from 'node:crypto';
import { apiSuccess } from '@sessionai/shared';
import { Router } from 'express';
import { getEnv } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { rescheduleAudioRetention } from '../services/sessions/audio-retention.js';
import {
  createSupabaseSubscriptionApplier,
  createSupabaseSubscriptionReader,
  type StoredSubscription,
  type SubscriptionApplier,
  type SubscriptionReader,
} from '../services/billing/repository.js';
import {
  subscriptionTransferFromEvent,
  subscriptionUpdateFromEvent,
  type RevenueCatEvent,
  type SubscriptionTransfer,
} from '../services/billing/revenuecat.js';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Constant-time check. RevenueCat sends the header value you configure, with or without "Bearer". */
export function authorizationMatches(header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const supplied = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;
  return timingSafeEqual(digest(supplied), digest(secret));
}

/** Server-to-server callbacks. Not authenticated with a user token, so each one checks a secret. */
export function createWebhooksRouter(
  options: {
    apply?: SubscriptionApplier;
    read?: SubscriptionReader;
    secret?: () => string;
    entitlementId?: () => string;
    /** Re-dates the user's stored audio after the subscription changes. */
    onSubscriptionChanged?: (userId: string, isPro: boolean) => Promise<void>;
  } = {},
) {
  const router = Router();
  const secret = options.secret ?? (() => getEnv().REVENUECAT_WEBHOOK_SECRET);
  const entitlementId = options.entitlementId ?? (() => getEnv().REVENUECAT_ENTITLEMENT_ID);
  const apply =
    options.apply ??
    ((update) => createSupabaseSubscriptionApplier(getSupabaseServiceClient())(update));
  const read =
    options.read ?? ((userId) => createSupabaseSubscriptionReader(getSupabaseServiceClient())(userId));
  const onSubscriptionChanged =
    options.onSubscriptionChanged ??
    ((userId: string, isPro: boolean) =>
      rescheduleAudioRetention(getSupabaseServiceClient(), userId, isPro));

  // Subscribing lifts the expiry from stored audio; lapsing starts the countdown that gives
  // them time to download it. Never fail the webhook over this — RevenueCat would retry an
  // event we already recorded.
  async function reschedule(userId: string, isPro: boolean) {
    try {
      await onSubscriptionChanged(userId, isPro);
    } catch (err) {
      logger.warn('Could not reschedule audio retention after a billing event', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /** Copy the stored subscription to the new owner and end it on the old one. */
  async function applyTransfer(transfer: SubscriptionTransfer): Promise<boolean> {
    let source: StoredSubscription | null = null;
    for (const userId of transfer.fromUserIds) {
      const row = await read(userId);
      if (row && (!source || row.isActive)) source = row;
      if (source?.isActive) break;
    }
    if (!source) return false;

    let applied = false;
    for (const userId of transfer.toUserIds) {
      if (await apply({ ...source, userId, eventMs: transfer.eventMs })) {
        applied = true;
        await reschedule(userId, source.isActive);
      }
    }
    for (const userId of transfer.fromUserIds) {
      const ended = await apply({
        userId,
        isActive: false,
        planId: null,
        expiresAt: null,
        environment: source.environment,
        eventMs: transfer.eventMs,
      });
      if (ended) {
        applied = true;
        await reschedule(userId, false);
      }
    }
    return applied;
  }

  router.post('/revenuecat', async (req, res, next) => {
    try {
      const expected = secret();
      if (!expected) {
        throw new AppError('WEBHOOK_DISABLED', 'Billing webhook is not configured', 503);
      }
      if (!authorizationMatches(req.headers.authorization, expected)) {
        throw new AppError('UNAUTHORIZED', 'Invalid webhook credentials', 401);
      }

      const event = (req.body as { event?: RevenueCatEvent } | undefined)?.event;
      const transfer = subscriptionTransferFromEvent(event);
      if (transfer) {
        const applied = await applyTransfer(transfer);
        logger.info('Billing transfer processed', { applied });
        res.status(200).json(apiSuccess({ applied }));
        return;
      }

      const update = subscriptionUpdateFromEvent(event, entitlementId());
      if (!update) {
        res.status(200).json(apiSuccess({ applied: false, reason: 'ignored' }));
        return;
      }

      const applied = await apply(update);
      if (applied) await reschedule(update.userId, update.isActive);
      logger.info('Billing event processed', {
        type: event?.type,
        applied,
        active: update.isActive,
      });
      res.status(200).json(apiSuccess({ applied }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
