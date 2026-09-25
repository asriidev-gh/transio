import type { SubscriptionPlanId } from '@/src/data/pricing';

/** Maps a RevenueCat package type to one of our three plans. Other durations are not sold. */
export function planIdFromPackageType(packageType: string | null | undefined): SubscriptionPlanId | null {
  switch (packageType) {
    case 'WEEKLY':
      return 'weekly';
    case 'MONTHLY':
      return 'monthly';
    case 'ANNUAL':
      return 'yearly';
    default:
      return null;
  }
}

/**
 * Best guess of the plan from a store product id such as "smart_transcriber_yearly:base".
 * Used for the entitlement, which reports the product but not the package type.
 */
export function planIdFromProductId(productId: string | null | undefined): SubscriptionPlanId | null {
  const id = (productId ?? '').toLowerCase();
  if (id.includes('week')) return 'weekly';
  if (id.includes('year') || id.includes('annual')) return 'yearly';
  if (id.includes('month')) return 'monthly';
  return null;
}
