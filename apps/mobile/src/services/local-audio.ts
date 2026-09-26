import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
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

/** Folder for audio the user asked us to keep on the phone. */
const DEVICE_AUDIO_DIR = 'device-audio';

function deviceAudioDirectory(): Directory {
  return new Directory(Paths.document, DEVICE_AUDIO_DIR);
}

/**
 * Copies a recording into our own document folder so it outlives the picker
 * grant that produced it.
 *
 * Imported files arrive as `content://` URIs that Android revokes once the
 * picker session ends, so without this a device-only import would play today
 * and fail tomorrow. Returns the original URI if the copy cannot be made, so
 * the caller always has something to upload.
 */
export async function persistDeviceAudioCopy(
  sessionId: string,
  uri: string,
  fileName = 'audio.m4a',
): Promise<string> {
  if (Platform.OS === 'web') return uri;
  if (!uri.startsWith('file://') && !uri.startsWith('content://')) return uri;

  try {
    const dir = deviceAudioDirectory();
    if (!dir.exists) dir.create({ intermediates: true });
    // Already ours from an earlier pass; copying again would just duplicate it.
    if (uri.startsWith(dir.uri)) return uri;

    const safeName = fileName.replace(/[^\w.-]+/g, '_') || 'audio.m4a';
    const destination = new File(dir, `${sessionId}-${safeName}`);
    if (destination.exists) destination.delete();
    await new File(uri).copy(destination);
    return destination.uri;
  } catch {
    return uri;
  }
}

/** Removes the on-device copy for a session, if we made one. */
export async function deleteDeviceAudioCopy(sessionId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const dir = deviceAudioDirectory();
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name.startsWith(`${sessionId}-`)) {
        entry.delete();
      }
    }
  } catch {
    // Best-effort: a stray file is better than a failed delete.
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
  // Our own persisted copies can be checked properly; other native URIs
  // (content:// grants, fresh recordings) are assumed good until upload says otherwise.
  if (uri.startsWith('file://') && Platform.OS !== 'web') {
    try {
      return new File(uri).exists;
    } catch {
      return false;
    }
  }
  return true;
}

export { localAudioStorageKey };
