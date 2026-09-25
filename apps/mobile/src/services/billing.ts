import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import type { SubscriptionPlanId } from '@/src/data/pricing';
import { mobileEnv } from '@/src/lib/env';
import { planIdFromPackageType, planIdFromProductId } from '@/src/services/billing-map';
import { applyBillingStatus } from '@/src/services/entitlements';

type PurchasesModule = typeof import('react-native-purchases').default;

/** A store package matched to one of our plans, with the price the store will charge. */
export interface PlanPackage {
  planId: SubscriptionPlanId;
  pkg: PurchasesPackage;
  priceString: string;
  /** Store-formatted monthly equivalent, when the store can compute it. */
  pricePerMonthString: string | null;
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'not-active';

let purchases: PurchasesModule | null | undefined;
let configured = false;
let currentUserId: string | null = null;

/**
 * The native module is loaded lazily inside a try: a build that lacks it, and the web app,
 * must fall back to "billing unavailable" instead of crashing at startup.
 */
function loadPurchases(): PurchasesModule | null {
  if (purchases !== undefined) return purchases;
  purchases = null;
  if (Platform.OS !== 'android') return purchases;

  try {
    purchases = (require('react-native-purchases') as { default: PurchasesModule }).default;
  } catch {
    purchases = null;
  }
  return purchases;
}

/** True when purchases can run: Android, a RevenueCat key is set, and the native module exists. */
export function isBillingAvailable(): boolean {
  return Boolean(mobileEnv.revenueCatAndroidKey) && loadPurchases() !== null;
}

async function applyCustomerInfo(info: CustomerInfo): Promise<boolean> {
  const entitlement = info.entitlements.active[mobileEnv.revenueCatEntitlementId];
  await applyBillingStatus(
    Boolean(entitlement),
    entitlement ? planIdFromProductId(entitlement.productIdentifier) : null,
  );
  return Boolean(entitlement);
}

function ensureConfigured(): PurchasesModule | null {
  if (!isBillingAvailable()) return null;
  const module = loadPurchases();
  if (!module) return null;

  if (!configured) {
    module.configure({ apiKey: mobileEnv.revenueCatAndroidKey });
    module.addCustomerInfoUpdateListener((info) => {
      void applyCustomerInfo(info);
    });
    configured = true;
  }
  return module;
}

/**
 * Tie purchases to the signed-in account, so the server webhook can match them to a user.
 * Call with the Supabase user id after sign-in, and with null after sign-out.
 */
export async function syncBillingUser(userId: string | null): Promise<void> {
  const module = ensureConfigured();
  if (!module) return;

  try {
    if (userId) {
      if (userId === currentUserId) return;
      const { customerInfo } = await module.logIn(userId);
      currentUserId = userId;
      await applyCustomerInfo(customerInfo);
      return;
    }
    if (currentUserId) {
      currentUserId = null;
      await module.logOut();
    }
  } catch {
    // Billing must never block sign-in. The next call retries.
  }
}

/** Packages from the current offering that match our weekly, monthly and yearly plans. */
export async function loadPlanPackages(): Promise<PlanPackage[]> {
  const module = ensureConfigured();
  if (!module) return [];

  const offerings = await module.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];

  const plans: PlanPackage[] = [];
  for (const pkg of packages) {
    // Prefer the package type. Fall back to the product id for custom or unknown package types.
    const planId = planIdFromPackageType(pkg.packageType) ?? planIdFromProductId(pkg.product.identifier);
    if (!planId) continue;
    plans.push({
      planId,
      pkg,
      priceString: pkg.product.priceString,
      pricePerMonthString: pkg.product.pricePerMonthString ?? null,
    });
  }
  return plans;
}

/** Start the store purchase flow for a package. A cancelled purchase is a normal outcome. */
export async function purchasePlan(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  const module = ensureConfigured();
  if (!module) throw new Error('Purchases are not available in this build.');

  try {
    const { customerInfo } = await module.purchasePackage(pkg);
    return (await applyCustomerInfo(customerInfo)) ? 'purchased' : 'not-active';
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'userCancelled' in err && err.userCancelled) {
      return 'cancelled';
    }
    throw new Error(
      err instanceof Error && err.message
        ? err.message
        : 'The purchase could not be completed. You have not been charged.',
    );
  }
}

/** Ask the store for earlier purchases on this Google account. True when Pro is active. */
export async function restoreBillingPurchases(): Promise<boolean> {
  const module = ensureConfigured();
  if (!module) return false;
  return applyCustomerInfo(await module.restorePurchases());
}
