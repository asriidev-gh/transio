import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AudioStorage } from '@sessionai/shared';

const KEY = 'sessionai:audio-storage';

/**
 * Where new sessions keep their audio once transcription finishes.
 *
 * `cloud` is the default: the file stays on the server, so it survives a
 * reinstall and plays on any signed-in device.
 *
 * `device` uploads the audio, transcribes it, then deletes the server copy.
 * The phone holds the only recording after that, so uninstalling the app or
 * clearing its storage loses it. Notes, transcripts and summaries are kept on
 * the server either way.
 */
export async function getAudioStoragePreference(): Promise<AudioStorage> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    if (value === 'device') return 'device';
  } catch {
    // Fall through to the safe default.
  }
  return 'cloud';
}

export async function setAudioStoragePreference(value: AudioStorage): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value);
  } catch {
    // Best-effort; the default stands if this fails.
  }
}
