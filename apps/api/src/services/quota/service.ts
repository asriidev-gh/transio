import { logger } from '../../lib/logger.js';
import { AppError } from '../../middleware/error-handler.js';
import type {
  QuotaCharge,
  QuotaContext,
  QuotaFeature,
  QuotaRepository,
} from './types.js';

export type QuotaMode = 'off' | 'log' | 'on';

export interface QuotaConfig {
  /**
   * off: no checks. log: count usage and log what would be blocked, but allow it.
   * on: block requests over the limit. The spend kill switch applies in log and on.
   */
  mode: QuotaMode;
  freeLimit: number;
  proDailyLimit: number;
  /** Global per-day caps by feature. Missing means no cap. */
  globalLimits: Partial<Record<QuotaFeature, number>>;
}

const NOOP_CHARGE: QuotaCharge = {
  async refund() {
    // Nothing was charged.
  },
};

const FEATURES: ReadonlySet<string> = new Set(['session', 'summary', 'voiceTranslate']);

/** Parses "session=300,summary=300,voiceTranslate=3000". Ignores anything malformed. */
export function parseGlobalLimits(value: string): Partial<Record<QuotaFeature, number>> {
  const limits: Partial<Record<QuotaFeature, number>> = {};
  for (const part of value.split(',')) {
    const [name, raw] = part.split('=').map((s) => s.trim());
    const limit = Number(raw);
    if (name && FEATURES.has(name) && Number.isInteger(limit) && limit >= 1) {
      limits[name as QuotaFeature] = limit;
    }
  }
  return limits;
}

function paywallMessage(feature: QuotaFeature): string {
  switch (feature) {
    case 'session':
      return 'Unlock Pro to keep recording and importing sessions.';
    case 'summary':
      return 'Unlock Pro to generate more AI Summaries.';
    case 'voiceTranslate':
      return 'Unlock Pro to keep using Voice translate.';
  }
}

function dailyMessage(feature: QuotaFeature): string {
  switch (feature) {
    case 'session':
      return 'You have reached today’s session limit. It resets tomorrow.';
    case 'summary':
      return 'You have reached today’s AI Summary limit. It resets tomorrow.';
    case 'voiceTranslate':
      return 'You have reached today’s Voice translate limit. It resets tomorrow.';
  }
}

export class QuotaService {
  constructor(
    private readonly repo: QuotaRepository | null,
    private readonly config: QuotaConfig,
  ) {}

  get mode(): QuotaMode {
    return this.repo ? this.config.mode : 'off';
  }

  /**
   * Charge one use of a feature. Throws a 402 (over the limit) or 503 (kill switch) AppError
   * when the request must not proceed, otherwise returns a handle to refund the charge if the
   * request then fails. Database trouble fails open: a blip must not take the app down.
   */
  async charge(
    ctx: QuotaContext,
    feature: QuotaFeature,
    options: { conversationId?: string | null } = {},
  ): Promise<QuotaCharge> {
    const repo = this.repo;
    if (!repo || this.config.mode === 'off') return NOOP_CHARGE;

    const conversationId = options.conversationId ?? null;
    const globalLimit = this.config.globalLimits[feature] ?? null;

    let isPro = false;
    let outcome;
    try {
      isPro = await repo.isPro(ctx.userId);
      outcome = await repo.consume({
        feature,
        userId: ctx.userId,
        deviceHash: ctx.deviceHash,
        isPro,
        freeLimit: this.config.freeLimit,
        proDailyLimit: this.config.proDailyLimit,
        globalLimit,
        conversationId,
      });
    } catch (err) {
      logger.error('Quota check failed; allowing the request', {
        feature,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      return NOOP_CHARGE;
    }

    switch (outcome) {
      case 'ok':
        return {
          refund: async () => {
            try {
              await repo.refund({
                feature,
                userId: ctx.userId,
                deviceHash: ctx.deviceHash,
                isPro,
                globalLimit,
                conversationId,
              });
            } catch (err) {
              logger.error('Quota refund failed', {
                feature,
                message: err instanceof Error ? err.message : 'Unknown error',
              });
            }
          },
        };
      case 'already_counted':
        return NOOP_CHARGE;
      case 'paused':
        logger.error('Spend kill switch tripped', { feature });
        throw new AppError(
          'SERVICE_PAUSED',
          'This feature is temporarily unavailable. Please try again later.',
          503,
        );
      case 'free_limit':
      case 'daily_limit': {
        if (this.config.mode !== 'on') {
          logger.warn('Quota would block this request (log mode)', {
            feature,
            outcome,
            hasDevice: ctx.deviceHash !== null,
          });
          return NOOP_CHARGE;
        }
        if (outcome === 'free_limit') {
          throw new AppError('QUOTA_EXCEEDED_FREE', paywallMessage(feature), 402);
        }
        throw new AppError('QUOTA_EXCEEDED_DAILY', dailyMessage(feature), 402);
      }
    }
  }

  /**
   * Record which account is the guest for this device. A second guest account on the same
   * device is a conflict: blocked in "on" mode, only logged in "log" mode.
   */
  async claimDevice(ctx: QuotaContext): Promise<{ claimed: boolean; conflict: boolean }> {
    const repo = this.repo;
    if (!repo || this.config.mode === 'off' || !ctx.isAnonymous || !ctx.deviceHash) {
      return { claimed: false, conflict: false };
    }

    let ownerUserId: string;
    try {
      ({ ownerUserId } = await repo.claimGuestDevice(ctx.userId, ctx.deviceHash));
    } catch (err) {
      logger.error('Device claim failed; allowing the request', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      return { claimed: false, conflict: false };
    }

    if (ownerUserId === ctx.userId) return { claimed: true, conflict: false };

    if (this.config.mode === 'on') {
      throw new AppError(
        'DEVICE_ALREADY_CLAIMED',
        'This device already has a guest account. Sign in with email to continue.',
        409,
      );
    }
    logger.warn('Second guest account on one device (log mode)');
    return { claimed: false, conflict: true };
  }
}
