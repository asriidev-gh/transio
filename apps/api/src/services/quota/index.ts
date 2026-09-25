import type { Request } from 'express';
import { getEnv } from '../../lib/env.js';
import { getSupabaseConfigStatus, getSupabaseServiceClient } from '../../lib/supabase.js';
import { AppError } from '../../middleware/error-handler.js';
import { deviceHashFromRequest } from './device.js';
import { SupabaseQuotaRepository } from './repository.js';
import { parseGlobalLimits, QuotaService } from './service.js';
import type { QuotaCharge, QuotaContext, QuotaFeature } from './types.js';

export type { QuotaCharge, QuotaFeature } from './types.js';
export { voiceConversationId } from './device.js';

let service: QuotaService | null = null;

/** Built once from the environment. Without the service role key there is nothing to check. */
export function getQuotaService(): QuotaService {
  if (service) return service;

  const env = getEnv();
  const repo = getSupabaseConfigStatus().hasServiceRole
    ? new SupabaseQuotaRepository(getSupabaseServiceClient())
    : null;

  service = new QuotaService(repo, {
    mode: env.QUOTA_MODE,
    freeLimit: env.FREE_LIMIT,
    proDailyLimit: env.PRO_DAILY_LIMIT,
    globalLimits: parseGlobalLimits(env.GLOBAL_DAILY_LIMITS),
  });
  return service;
}

/** Tests only: swap in a service, or pass null to rebuild from the environment. */
export function setQuotaServiceForTests(next: QuotaService | null): void {
  service = next;
}

export function quotaContextFromRequest(req: Request): QuotaContext {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return {
    userId: req.user.id,
    isAnonymous: req.user.isAnonymous === true,
    deviceHash: deviceHashFromRequest(req, getEnv().DEVICE_HASH_SECRET),
  };
}

/** Charge one use for the signed-in caller. See QuotaService.charge for the outcomes. */
export function chargeQuota(
  req: Request,
  feature: QuotaFeature,
  options: { conversationId?: string | null } = {},
): Promise<QuotaCharge> {
  return getQuotaService().charge(quotaContextFromRequest(req), feature, options);
}
