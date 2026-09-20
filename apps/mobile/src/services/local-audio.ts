import AsyncStorage from '@react-native-async-storage/async-storage';
import { localAudioStorageKey } from '@/src/utils/local-audio-key';

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

/**
 * Persists a local recording URI for a session until cloud upload.
 * On web, blob: URLs are ephemeral — convert to a data: URL so retry survives navigation.
 */
export async function saveLocalAudioUri(sessionId: string, uri: string): Promise<string> {
  let stored = uri;

  if (uri.startsWith('blob:')) {
    try {
      const blob = await (await fetch(uri)).blob();
      stored = await blobToDataUrl(blob);
    } catch {
      // Fall back to the original URI; upload may still work in the same tick.
      stored = uri;
    }
  }

  await AsyncStorage.setItem(localAudioStorageKey(sessionId), stored);
  return stored;
}

export async function getLocalAudioUri(sessionId: string): Promise<string | null> {
  return AsyncStorage.getItem(localAudioStorageKey(sessionId));
}

export async function clearLocalAudioUri(sessionId: string): Promise<void> {
  await AsyncStorage.removeItem(localAudioStorageKey(sessionId));
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
