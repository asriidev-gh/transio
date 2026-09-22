import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CaptureMode } from '@sessionai/shared';
import { isLiveCaptionsSupported } from './live-captions';

/** How a mic capture session should handle speech-to-text / notes. */
export type RecordCaptionsMode = CaptureMode;

const PREF_KEY = 'record-captions-mode';

const ALL_MODES: RecordCaptionsMode[] = ['live', 'batch', 'notes', 'live_notes'];

export function isLiveCaptionsModeAvailable(): boolean {
  return isLiveCaptionsSupported();
}

export function modeNeedsLiveStt(mode: RecordCaptionsMode): boolean {
  return mode === 'live' || mode === 'live_notes';
}

export function isNotesOnlyMode(mode: RecordCaptionsMode): boolean {
  return mode === 'notes' || mode === 'live_notes';
}

export async function getRecordCaptionsModePref(): Promise<RecordCaptionsMode> {
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    if (raw && ALL_MODES.includes(raw as RecordCaptionsMode)) {
      const mode = raw as RecordCaptionsMode;
      if (modeNeedsLiveStt(mode) && !isLiveCaptionsModeAvailable()) {
        return mode === 'live_notes' ? 'notes' : 'batch';
      }
      return mode;
    }
  } catch {
    // ignore
  }
  return isLiveCaptionsModeAvailable() ? 'live' : 'batch';
}

export async function setRecordCaptionsModePref(mode: RecordCaptionsMode): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, mode);
  } catch {
    // ignore
  }
}

export function parseRecordCaptionsMode(
  value: string | string[] | undefined,
): RecordCaptionsMode | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && ALL_MODES.includes(raw as RecordCaptionsMode)) {
    return raw as RecordCaptionsMode;
  }
  return null;
}
