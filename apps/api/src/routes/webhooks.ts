import { createHash, timingSafeEqual } from 'node:crypto';
import { apiSuccess } from '@sessionai/shared';
import { Router } from 'express';
import { getEnv } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import {
  createSupabaseSubscriptionApplier,
  type SubscriptionApplier,
} from '../services/billing/repository.js';
import {
  subscriptionUpdateFromEvent,
  type RevenueCatEvent,
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
  options: { apply?: SubscriptionApplier; secret?: () => string; entitlementId?: () => string } = {},
) {
  const router = Router();
  const secret = options.secret ?? (() => getEnv().REVENUECAT_WEBHOOK_SECRET);
  const entitlementId = options.entitlementId ?? (() => getEnv().REVENUECAT_ENTITLEMENT_ID);
  const apply =
    options.apply ??
    ((update) => createSupabaseSubscriptionApplier(getSupabaseServiceClient())(update));

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
      const update = subscriptionUpdateFromEvent(event, entitlementId());
      if (!update) {
        res.status(200).json(apiSuccess({ applied: false, reason: 'ignored' }));
        return;
      }

      const applied = await apply(update);
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
