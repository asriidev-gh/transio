/**
 * Turns RevenueCat webhook events into subscription updates.
 * https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */

export interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  new_product_id?: string;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  environment?: string;
  /** TRANSFER only: the app user ids the purchase moved from and to. */
  transferred_from?: string[];
  transferred_to?: string[];
}

export interface SubscriptionUpdate {
  userId: string;
  isActive: boolean;
  planId: string | null;
  /** ISO time when access ends, or null for no expiry. */
  expiresAt: string | null;
  environment: string | null;
  eventMs: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Events that describe a live or lapsing subscription. Access lasts until the expiration
 * time even after a cancellation or a billing issue, so these all use the same rule.
 */
const ACCESS_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'CANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

function accountIds(ids: string[] | undefined): string[] {
  const out: string[] = [];
  for (const id of ids ?? []) {
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) continue;
    const lower = id.toLowerCase();
    if (!out.includes(lower)) out.push(lower);
  }
  return out;
}

/** Our accounts use Supabase user ids as the RevenueCat app user id. Anonymous ids are skipped. */
export function pickUserId(event: RevenueCatEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  for (const id of candidates) {
    if (typeof id === 'string' && UUID_PATTERN.test(id)) return id.toLowerCase();
  }
  return null;
}

/**
 * Returns the update to store, or null when the event should be ignored: test events,
 * transfers (see subscriptionTransferFromEvent), other entitlements, anonymous users and event types that change nothing.
 */
export function subscriptionUpdateFromEvent(
  event: RevenueCatEvent | undefined,
  entitlementId: string,
  now: number = Date.now(),
): SubscriptionUpdate | null {
  if (!event || typeof event.type !== 'string') return null;

  const isExpiration = event.type === 'EXPIRATION';
  if (!isExpiration && !ACCESS_EVENTS.has(event.type)) return null;

  const entitlements = event.entitlement_ids;
  if (Array.isArray(entitlements) && entitlements.length > 0 && !entitlements.includes(entitlementId)) {
    return null;
  }

  const userId = pickUserId(event);
  if (!userId) return null;

  const expirationMs =
    typeof event.expiration_at_ms === 'number' && Number.isFinite(event.expiration_at_ms)
      ? event.expiration_at_ms
      : null;

  return {
    userId,
    isActive: isExpiration ? false : expirationMs === null || expirationMs > now,
    planId: event.new_product_id ?? event.product_id ?? null,
    expiresAt: expirationMs === null ? null : new Date(expirationMs).toISOString(),
    environment: event.environment ?? null,
    eventMs:
      typeof event.event_timestamp_ms === 'number' && Number.isFinite(event.event_timestamp_ms)
        ? event.event_timestamp_ms
        : now,
  };
}

export interface SubscriptionTransfer {
  fromUserIds: string[];
  toUserIds: string[];
  eventMs: number;
}

/**
 * A restore on another account moves the purchase there (RevenueCat's default transfer rule).
 * The event names both sides but carries no subscription details, so the caller copies the
 * stored row. Returns null for other events or when either side has no account of ours.
 */
export function subscriptionTransferFromEvent(
  event: RevenueCatEvent | undefined,
  now: number = Date.now(),
): SubscriptionTransfer | null {
  if (!event || event.type !== 'TRANSFER') return null;
  const fromUserIds = accountIds(event.transferred_from);
  const toUserIds = accountIds(event.transferred_to).filter((id) => !fromUserIds.includes(id));
  if (fromUserIds.length === 0 || toUserIds.length === 0) return null;
  return {
    fromUserIds,
    toUserIds,
    eventMs:
      typeof event.event_timestamp_ms === 'number' && Number.isFinite(event.event_timestamp_ms)
        ? event.event_timestamp_ms
        : now,
  };
}
