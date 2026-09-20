import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { mobileEnv } from '@/src/lib/env';

/**
 * Lightweight API reachability probe (no extra NetInfo dependency).
 * Re-checks when the app returns to foreground.
 */
export function useApiReachable(pollMs = 20000): {
  reachable: boolean | null;
  refresh: () => Promise<void>;
} {
  const [reachable, setReachable] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, '')}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      setReachable(res.ok);
    } catch {
      setReachable(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, pollMs);
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        void refresh();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [pollMs, refresh]);

  return { reachable, refresh };
}
