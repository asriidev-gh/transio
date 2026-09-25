/** Features with a usage limit. Mirrors the gated features in the mobile app. */
export type QuotaFeature = 'session' | 'summary' | 'voiceTranslate';

/** Result of one atomic consume attempt in the database. */
export type ConsumeOutcome =
  | 'ok'
  | 'already_counted'
  | 'free_limit'
  | 'daily_limit'
  | 'paused';

export interface ConsumeParams {
  feature: QuotaFeature;
  userId: string;
  /** Hashed device id, or null when the client did not send one. */
  deviceHash: string | null;
  isPro: boolean;
  freeLimit: number;
  proDailyLimit: number;
  /** Global per-day cap for this feature (the spend kill switch), or null for none. */
  globalLimit: number | null;
  /** Voice translate only: a conversation is charged once. */
  conversationId: string | null;
}

export type RefundParams = Pick<
  ConsumeParams,
  'feature' | 'userId' | 'deviceHash' | 'isPro' | 'globalLimit' | 'conversationId'
>;

export interface QuotaRepository {
  consume(params: ConsumeParams): Promise<ConsumeOutcome>;
  refund(params: RefundParams): Promise<void>;
  isPro(userId: string): Promise<boolean>;
  /** Records the first guest account for a device and returns whichever user owns it. */
  claimGuestDevice(userId: string, deviceHash: string): Promise<{ ownerUserId: string }>;
}

/** Who is making the request. */
export interface QuotaContext {
  userId: string;
  isAnonymous: boolean;
  deviceHash: string | null;
}

/** Handle to undo a charge when the request it paid for fails. */
export interface QuotaCharge {
  refund(): Promise<void>;
}
