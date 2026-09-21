import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sessionai:has-seen-onboarding';

/** In-memory cache so AuthGate sees updates immediately after mark/reset. */
let cached: boolean | null = null;

export async function hasSeenOnboarding(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const value = await AsyncStorage.getItem(KEY);
    cached = value === '1';
    return cached;
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  cached = true;
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Best-effort; user may see onboarding again.
  }
}

/** Dev/testing helper — used from Settings “Replay onboarding”. */
export async function resetOnboarding(): Promise<void> {
  cached = false;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
