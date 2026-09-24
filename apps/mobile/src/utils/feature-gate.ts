import type { Href } from 'expo-router';
import {
  gateFeature,
  type GatedFeature,
} from '@/src/services/entitlements';
import { showAlert } from '@/src/utils/confirm';

type RouterLike = {
  push: (href: Href) => void;
};

/**
 * Returns true when the action may proceed.
 * Free limit → paywall. Pro daily limit → alert (resets tomorrow).
 */
export async function ensureFeatureAccess(
  feature: GatedFeature,
  router: RouterLike,
  options?: { voiceConversationId?: string | null },
): Promise<boolean> {
  const result = await gateFeature(feature, options);
  if (result.ok) return true;
  if (result.kind === 'daily') {
    await showAlert('Daily limit reached', result.message);
    return false;
  }
  router.push(`/paywall?feature=${feature}` as Href);
  return false;
}
