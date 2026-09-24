import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, SessionFolder } from '@sessionai/shared';

const KEY = 'smart-transcriber-home-cache-v1';

export interface HomeCache {
  sessions: Session[];
  folders: SessionFolder[];
  savedAt: string;
}

export async function readHomeCache(): Promise<HomeCache | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeCache;
    if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.folders)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeHomeCache(
  sessions: Session[],
  folders: SessionFolder[],
): Promise<void> {
  try {
    const payload: HomeCache = {
      sessions,
      folders,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Best-effort cache only.
  }
}
