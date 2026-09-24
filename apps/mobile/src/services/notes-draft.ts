import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionSummary } from '@sessionai/shared';

const keyFor = (sessionId: string) => `smart-transcriber-notes-draft-v1:${sessionId}`;

/** Stash notes on stop so the session screen can paint before GET /notes returns. */
export async function writeNotesDraft(
  sessionId: string,
  notes: SessionSummary,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(sessionId), JSON.stringify(notes));
  } catch {
    // Best-effort.
  }
}

export async function readNotesDraft(
  sessionId: string,
): Promise<SessionSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionSummary;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearNotesDraft(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(sessionId));
  } catch {
    // Best-effort.
  }
}
