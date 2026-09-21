import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppearancePreference } from '@/src/theme/tokens';

const KEY = 'sessionai:appearance';

export async function getAppearancePreference(): Promise<AppearancePreference> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // ignore
  }
  return 'dark';
}

export async function setAppearancePreference(value: AppearancePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value);
  } catch {
    // Best-effort.
  }
}
