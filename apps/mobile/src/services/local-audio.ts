import AsyncStorage from '@react-native-async-storage/async-storage';
import { localAudioStorageKey } from '@/src/utils/local-audio-key';

/**
 * Persists a local recording URI for a session until cloud upload (Phase 5).
 */
export async function saveLocalAudioUri(sessionId: string, uri: string): Promise<void> {
  await AsyncStorage.setItem(localAudioStorageKey(sessionId), uri);
}

export async function getLocalAudioUri(sessionId: string): Promise<string | null> {
  return AsyncStorage.getItem(localAudioStorageKey(sessionId));
}

export async function clearLocalAudioUri(sessionId: string): Promise<void> {
  await AsyncStorage.removeItem(localAudioStorageKey(sessionId));
}

export { localAudioStorageKey };
