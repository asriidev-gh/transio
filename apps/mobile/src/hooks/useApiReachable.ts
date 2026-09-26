import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { mobileEnv } from '@/src/lib/env';

const DEFAULT_POLL_MS = 20_000;
/** Pause between attempts while the API is down (Render cold starts). */
const RETRY_MS = 3_000;
const PROBE_TIMEOUT_MS = 6_000;

/**
 * Lightweight API reachability probe (no extra NetInfo dependency).
 * Re-checks when the app returns to the foreground.
 * While the API is down, retries in the background until it answers.
 */
export function useApiReachable(pollMs = DEFAULT_POLL_MS): {
  reachable: boolean | null;
  refresh: () => Promise<void>;
} {
  const [reachable, setReachable] = useState<boolean | null>(null);
  const seq = useRef(0);
  /** Latest probe result. Only the newest in-flight request may write this. */
  const lastOk = useRef<boolean | null>(null);

  const probe = useCallback(async (): Promise<void> => {
    const id = ++seq.current;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, '')}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (id !== seq.current) return;
      const ok = res.ok;
      lastOk.current = ok;
      setReachable(ok);
    } catch {
      if (id !== seq.current) return;
      lastOk.current = false;
      setReachable(false);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const refresh = useCallback(async () => {
    await probe();
  }, [probe]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void tick();
      }, delay);
    };

    const tick = async () => {
      await probe();
      if (cancelled) return;
      schedule(lastOk.current === false ? RETRY_MS : pollMs);
    };

    void tick();

    const onAppState = (next: AppStateStatus) => {
      if (next !== 'active' || cancelled) return;
      void tick();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      seq.current += 1;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [pollMs, probe]);

  return { reachable, refresh };
}
