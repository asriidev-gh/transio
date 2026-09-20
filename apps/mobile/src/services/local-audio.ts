import AsyncStorage from '@react-native-async-storage/async-storage';
import { localAudioStorageKey } from '@/src/utils/local-audio-key';

/** Keep persisted web audio under typical AsyncStorage quotas (~5MB). */
const MAX_PERSISTED_DATA_URL_CHARS = 4_000_000;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Could not read recording data'));
    };
    reader.onerror = () => reject(new Error('Could not read recording data'));
    reader.readAsDataURL(blob);
  });
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string; code?: number };
  return (
    e.name === 'QuotaExceededError' ||
    e.code === 22 ||
    /quota/i.test(e.message ?? '')
  );
}

/**
 * Persists a local recording URI for a session until cloud upload.
 * On web, blob: URLs are ephemeral — convert to a data: URL when small enough.
 * Never throws on quota / persistence failures; returns the best usable URI.
 */
export async function saveLocalAudioUri(sessionId: string, uri: string): Promise<string> {
  let stored = uri;

  if (uri.startsWith('blob:')) {
    try {
      const blob = await (await fetch(uri)).blob();
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl.length <= MAX_PERSISTED_DATA_URL_CHARS) {
        stored = dataUrl;
      }
      // If too large, keep the live blob: URI for same-tab upload/retry.
    } catch {
      stored = uri;
    }
  }

  try {
    await AsyncStorage.setItem(localAudioStorageKey(sessionId), stored);
  } catch (err) {
    if (isQuotaError(err) && stored.startsWith('data:')) {
      // Fall back to storing the original URI (or nothing durable).
      try {
        await AsyncStorage.setItem(localAudioStorageKey(sessionId), uri);
        return uri;
      } catch {
        return uri;
      }
    }
    // Persistence is best-effort; callers can still upload from the returned URI.
    return stored.startsWith('data:') ? stored : uri;
  }

  return stored;
}

export async function getLocalAudioUri(sessionId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(localAudioStorageKey(sessionId));
  } catch {
    return null;
  }
}

export async function clearLocalAudioUri(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(localAudioStorageKey(sessionId));
  } catch {
    // ignore
  }
}

/** Returns true when a stored URI can still be read (blob:/data:/file). */
export async function isLocalAudioReadable(uri: string): Promise<boolean> {
  if (!uri) return false;
  if (uri.startsWith('data:')) return true;
  if (uri.startsWith('blob:') || uri.startsWith('http')) {
    try {
      const res = await fetch(uri);
      return res.ok;
    } catch {
      return false;
    }
  }
  // Native file:// / content:// URIs — assume readable until upload proves otherwise.
  return true;
}

export { localAudioStorageKey };
