import { useEffect, useRef } from 'react';
import { useRouter, type Href } from 'expo-router';
import { subscribeQuotaBlocked } from '@/src/services/quota-events';
import { showAlert } from '@/src/utils/confirm';

/** Ignore refusals that arrive right after one that was already shown. */
const QUIET_MS = 3000;

/**
 * Handles "usage limit reached" answers from the API in one place: over the free limit opens
 * the paywall, the daily or paused cases show a message. The guest device conflict is handled
 * where guest sign-in happens, so it is skipped here.
 */
export function QuotaBlockedHandler() {
  const router = useRouter();
  const lastShownAt = useRef(0);

  useEffect(() => {
    return subscribeQuotaBlocked((block) => {
      if (block.kind === 'device') return;
      const now = Date.now();
      if (now - lastShownAt.current < QUIET_MS) return;
      lastShownAt.current = now;

      if (block.kind === 'paywall') {
        router.push('/paywall' as Href);
        return;
      }
      void showAlert(
        block.kind === 'daily' ? 'Daily limit reached' : 'Temporarily unavailable',
        block.message,
      );
    });
  }, [router]);

  return null;
}
