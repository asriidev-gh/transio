import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubscriptionPlanId } from '@/src/data/pricing';

/** Bumped when free/pro quota model changes. */
const STORAGE_KEY = 'smart-transcriber-entitlements-v3';

/** Free / guest lifetime allowance per gated feature (then paywall). */
export const FREE_LIMIT = 2;

/** Subscribed users: max uses per feature per local calendar day. */
export const PRO_DAILY_LIMIT = 5;

export type GatedFeature = 'session' | 'summary' | 'voiceTranslate';

export type FeatureGateResult =
  | { ok: true }
  | { ok: false; kind: 'paywall'; message: string }
  | { ok: false; kind: 'daily'; message: string };

export interface EntitlementState {
  /** Local Pro unlock until App Store / Play Billing is wired. */
  isPremium: boolean;
  planId: SubscriptionPlanId | null;
  /** ISO timestamp when Pro was unlocked (local). */
  unlockedAt: string | null;
  /** Lifetime free/guest counters (do not reset daily). */
  free: {
    sessionCount: number;
    summaryCount: number;
    voiceTranslateCount: number;
    voiceTranslateConversationId: string | null;
  };
  /** Pro daily counters (reset each local calendar day). */
  proDaily: {
    dayKey: string;
    sessionCount: number;
    summaryCount: number;
    voiceTranslateCount: number;
    voiceTranslateConversationId: string | null;
  };
}

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function emptyFree(): EntitlementState['free'] {
  return {
    sessionCount: 0,
    summaryCount: 0,
    voiceTranslateCount: 0,
    voiceTranslateConversationId: null,
  };
}

function emptyProDaily(dayKey = todayKey()): EntitlementState['proDaily'] {
  return {
    dayKey,
    sessionCount: 0,
    summaryCount: 0,
    voiceTranslateCount: 0,
    voiceTranslateConversationId: null,
  };
}

const DEFAULT_STATE: EntitlementState = {
  isPremium: false,
  planId: null,
  unlockedAt: null,
  free: emptyFree(),
  proDaily: emptyProDaily(),
};

type Listener = (state: EntitlementState) => void;
const listeners = new Set<Listener>();

function notify(state: EntitlementState) {
  for (const listener of listeners) listener(state);
}

export function subscribeEntitlements(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function freeCount(state: EntitlementState, feature: GatedFeature): number {
  switch (feature) {
    case 'session':
      return state.free.sessionCount;
    case 'summary':
      return state.free.summaryCount;
    case 'voiceTranslate':
      return state.free.voiceTranslateCount;
  }
}

function proCount(state: EntitlementState, feature: GatedFeature): number {
  switch (feature) {
    case 'session':
      return state.proDaily.sessionCount;
    case 'summary':
      return state.proDaily.summaryCount;
    case 'voiceTranslate':
      return state.proDaily.voiceTranslateCount;
  }
}

function withCurrentProDay(state: EntitlementState): EntitlementState {
  const day = todayKey();
  if (state.proDaily.dayKey === day) return state;
  return { ...state, proDaily: emptyProDaily(day) };
}

function normalizeLoaded(parsed: Partial<EntitlementState>): EntitlementState {
  const freeRaw = parsed.free as Partial<EntitlementState['free']> | undefined;
  const proRaw = parsed.proDaily as Partial<EntitlementState['proDaily']> | undefined;
  const base: EntitlementState = {
    isPremium: Boolean(parsed.isPremium),
    planId: parsed.planId ?? null,
    unlockedAt: parsed.unlockedAt ?? null,
    free: {
      sessionCount: Math.max(0, Number(freeRaw?.sessionCount) || 0),
      summaryCount: Math.max(0, Number(freeRaw?.summaryCount) || 0),
      voiceTranslateCount: Math.max(0, Number(freeRaw?.voiceTranslateCount) || 0),
      voiceTranslateConversationId: freeRaw?.voiceTranslateConversationId ?? null,
    },
    proDaily: {
      dayKey: typeof proRaw?.dayKey === 'string' ? proRaw.dayKey : todayKey(),
      sessionCount: Math.max(0, Number(proRaw?.sessionCount) || 0),
      summaryCount: Math.max(0, Number(proRaw?.summaryCount) || 0),
      voiceTranslateCount: Math.max(0, Number(proRaw?.voiceTranslateCount) || 0),
      voiceTranslateConversationId: proRaw?.voiceTranslateConversationId ?? null,
    },
  };
  return withCurrentProDay(base);
}

export async function loadEntitlements(): Promise<EntitlementState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, free: emptyFree(), proDaily: emptyProDaily() };
    const parsed = JSON.parse(raw) as Partial<EntitlementState>;
    const previousDay =
      typeof (parsed.proDaily as { dayKey?: string } | undefined)?.dayKey === 'string'
        ? (parsed.proDaily as { dayKey: string }).dayKey
        : null;
    const next = normalizeLoaded(parsed);
    if (previousDay !== next.proDaily.dayKey) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return next;
  } catch {
    return { ...DEFAULT_STATE, free: emptyFree(), proDaily: emptyProDaily() };
  }
}

async function saveEntitlements(state: EntitlementState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  notify(state);
}

export async function isPremiumUser(): Promise<boolean> {
  const state = await loadEntitlements();
  return state.isPremium;
}

function voiceContinuing(
  conversationId: string | null | undefined,
  allowedId: string | null,
): boolean {
  return Boolean(conversationId && allowedId && conversationId === allowedId);
}

export function featurePaywallMessage(feature: GatedFeature): string {
  switch (feature) {
    case 'session':
      return 'Unlock Pro to keep recording and importing sessions.';
    case 'summary':
      return 'Unlock Pro to generate more AI Summaries.';
    case 'voiceTranslate':
      return 'Unlock Pro to keep using Voice translate.';
    default:
      return 'Unlock Pro to continue.';
  }
}

export function featureDailyLimitMessage(feature: GatedFeature): string {
  switch (feature) {
    case 'session':
      return 'You’ve reached today’s session limit. It resets tomorrow.';
    case 'summary':
      return 'You’ve reached today’s AI Summary limit. It resets tomorrow.';
    case 'voiceTranslate':
      return 'You’ve reached today’s Voice translate limit. It resets tomorrow.';
    default:
      return 'You’ve reached today’s limit. It resets tomorrow.';
  }
}

/**
 * Check whether a gated action is allowed.
 * Free/guest → lifetime cap then paywall.
 * Pro → daily cap then wait-until-tomorrow (not paywall).
 */
export async function gateFeature(
  feature: GatedFeature,
  options?: { voiceConversationId?: string | null },
): Promise<FeatureGateResult> {
  const state = await loadEntitlements();

  if (state.isPremium) {
    if (
      feature === 'voiceTranslate' &&
      voiceContinuing(options?.voiceConversationId, state.proDaily.voiceTranslateConversationId)
    ) {
      return { ok: true };
    }
    if (proCount(state, feature) >= PRO_DAILY_LIMIT) {
      return { ok: false, kind: 'daily', message: featureDailyLimitMessage(feature) };
    }
    return { ok: true };
  }

  if (
    feature === 'voiceTranslate' &&
    voiceContinuing(options?.voiceConversationId, state.free.voiceTranslateConversationId)
  ) {
    return { ok: true };
  }

  if (freeCount(state, feature) >= FREE_LIMIT) {
    return { ok: false, kind: 'paywall', message: featurePaywallMessage(feature) };
  }
  return { ok: true };
}

/** @deprecated Prefer gateFeature — kept for simple boolean checks. */
export async function canUseFeature(
  feature: GatedFeature,
  options?: { voiceConversationId?: string | null },
): Promise<boolean> {
  const result = await gateFeature(feature, options);
  return result.ok;
}

/** Mark quota consumed for free or Pro daily bucket. */
export async function consumeFeature(
  feature: GatedFeature,
  options?: { voiceConversationId?: string },
): Promise<void> {
  const state = await loadEntitlements();
  const next: EntitlementState = {
    ...state,
    free: { ...state.free },
    proDaily: { ...state.proDaily },
  };

  if (state.isPremium) {
    const openId = options?.voiceConversationId;
    if (feature === 'voiceTranslate') {
      const continuing = voiceContinuing(openId, next.proDaily.voiceTranslateConversationId);
      if (!continuing) {
        next.proDaily.voiceTranslateCount = Math.min(
          PRO_DAILY_LIMIT,
          next.proDaily.voiceTranslateCount + 1,
        );
        if (openId) next.proDaily.voiceTranslateConversationId = openId;
      }
    } else if (feature === 'session') {
      next.proDaily.sessionCount = Math.min(PRO_DAILY_LIMIT, next.proDaily.sessionCount + 1);
    } else if (feature === 'summary') {
      next.proDaily.summaryCount = Math.min(PRO_DAILY_LIMIT, next.proDaily.summaryCount + 1);
    }
  } else {
    const openId = options?.voiceConversationId;
    if (feature === 'voiceTranslate') {
      const continuing = voiceContinuing(openId, next.free.voiceTranslateConversationId);
      if (!continuing) {
        next.free.voiceTranslateCount = Math.min(FREE_LIMIT, next.free.voiceTranslateCount + 1);
        if (openId) next.free.voiceTranslateConversationId = openId;
      }
    } else if (feature === 'session') {
      next.free.sessionCount = Math.min(FREE_LIMIT, next.free.sessionCount + 1);
    } else if (feature === 'summary') {
      next.free.summaryCount = Math.min(FREE_LIMIT, next.free.summaryCount + 1);
    }
  }

  await saveEntitlements(next);
}

export async function unlockPremium(planId: SubscriptionPlanId): Promise<EntitlementState> {
  const next: EntitlementState = {
    ...(await loadEntitlements()),
    isPremium: true,
    planId,
    unlockedAt: new Date().toISOString(),
  };
  await saveEntitlements(next);
  return next;
}

/**
 * Store billing is the source of truth for Pro. Call with the current entitlement state after
 * every purchase, restore or customer update. Revoking here also clears any local preview unlock.
 */
export async function applyBillingStatus(
  active: boolean,
  planId: SubscriptionPlanId | null,
): Promise<void> {
  const state = await loadEntitlements();
  if (active) {
    if (state.isPremium && state.planId === planId) return;
    await saveEntitlements({
      ...state,
      isPremium: true,
      planId,
      unlockedAt: state.unlockedAt ?? new Date().toISOString(),
    });
    return;
  }
  if (!state.isPremium) return;
  await saveEntitlements({ ...state, isPremium: false, planId: null, unlockedAt: null });
}

/** Dev / pre-billing restore stub. */
export async function restorePremium(): Promise<EntitlementState | null> {
  const state = await loadEntitlements();
  if (state.isPremium) return state;
  return null;
}

export async function clearPremium(): Promise<void> {
  const state = await loadEntitlements();
  await saveEntitlements({
    ...state,
    isPremium: false,
    planId: null,
    unlockedAt: null,
  });
}
