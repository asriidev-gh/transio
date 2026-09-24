import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TranslateLanguage } from '@sessionai/shared';

const VOICE_PREF_KEY = 'voice-translate-voice-id';
const ACTIVE_KEY = 'voice-translate-active-v2';
const HISTORY_KEY = 'voice-translate-history-v2';
/** Pre-history draft — migrated once into ACTIVE_KEY. */
const LEGACY_DRAFT_KEY = 'voice-translate-conversation-draft';

const MAX_TURNS = 80;
const MAX_HISTORY = 40;

export interface VoiceTranslateTurn {
  id: string;
  sourceText: string;
  translatedText: string;
  /** Spoken / detected language for speaker TTS (may be missing on older drafts). */
  sourceLanguage?: string;
  targetLanguage: TranslateLanguage;
  createdAt: string;
}

export interface VoiceTranslateConversation {
  id: string;
  turns: VoiceTranslateTurn[];
  sourceLang: string;
  targetLang: TranslateLanguage;
  createdAt: string;
  updatedAt: string;
}

export async function getPreferredVoiceId(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(VOICE_PREF_KEY)) || null;
  } catch {
    return null;
  }
}

export async function setPreferredVoiceId(voiceId: string | null): Promise<void> {
  try {
    if (!voiceId) await AsyncStorage.removeItem(VOICE_PREF_KEY);
    else await AsyncStorage.setItem(VOICE_PREF_KEY, voiceId);
  } catch {
    // ignore
  }
}

function newConversationId(): string {
  return `vt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyConversation(
  sourceLang = 'auto',
  targetLang: TranslateLanguage = 'en',
): VoiceTranslateConversation {
  const now = new Date().toISOString();
  return {
    id: newConversationId(),
    turns: [],
    sourceLang,
    targetLang,
    createdAt: now,
    updatedAt: now,
  };
}

function isConversation(value: unknown): value is VoiceTranslateConversation {
  if (!value || typeof value !== 'object') return false;
  const c = value as VoiceTranslateConversation;
  return (
    typeof c.id === 'string' &&
    Array.isArray(c.turns) &&
    typeof c.sourceLang === 'string' &&
    typeof c.targetLang === 'string' &&
    typeof c.createdAt === 'string' &&
    typeof c.updatedAt === 'string'
  );
}

async function migrateLegacyDraft(): Promise<VoiceTranslateConversation | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_DRAFT_KEY);
    if (!raw) return null;
    const turns = JSON.parse(raw) as VoiceTranslateTurn[];
    await AsyncStorage.removeItem(LEGACY_DRAFT_KEY);
    if (!Array.isArray(turns) || turns.length === 0) return null;
    const now = new Date().toISOString();
    return {
      id: newConversationId(),
      turns: turns.slice(-MAX_TURNS),
      sourceLang: 'auto',
      targetLang: turns[turns.length - 1]?.targetLanguage ?? 'en',
      createdAt: turns[0]?.createdAt ?? now,
      updatedAt: turns[turns.length - 1]?.createdAt ?? now,
    };
  } catch {
    return null;
  }
}

export async function loadActiveConversation(): Promise<VoiceTranslateConversation | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isConversation(parsed)) return parsed;
    }
    const migrated = await migrateLegacyDraft();
    if (migrated) {
      await saveActiveConversation(migrated);
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveActiveConversation(
  conversation: VoiceTranslateConversation | null,
): Promise<void> {
  try {
    if (!conversation || conversation.turns.length === 0) {
      // Keep empty active shell so language prefs persist; drop if null.
      if (!conversation) {
        await AsyncStorage.removeItem(ACTIVE_KEY);
        return;
      }
    }
    const next: VoiceTranslateConversation = {
      ...conversation,
      turns: conversation.turns.slice(-MAX_TURNS),
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function listConversationHistory(): Promise<VoiceTranslateConversation[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isConversation);
  } catch {
    return [];
  }
}

async function writeHistory(items: VoiceTranslateConversation[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

/** Move a non-empty conversation into history (newest first). Skips empties. */
export async function archiveConversation(
  conversation: VoiceTranslateConversation,
): Promise<void> {
  if (conversation.turns.length === 0) return;
  try {
    const history = await listConversationHistory();
    const withoutDup = history.filter((c) => c.id !== conversation.id);
    const archived: VoiceTranslateConversation = {
      ...conversation,
      turns: conversation.turns.slice(-MAX_TURNS),
      updatedAt: new Date().toISOString(),
    };
    await writeHistory([archived, ...withoutDup]);
  } catch {
    // ignore
  }
}

/** Archive current (if any turns), then return a fresh empty conversation. */
export async function startNewConversation(
  current: VoiceTranslateConversation | null,
  sourceLang = 'auto',
  targetLang: TranslateLanguage = 'en',
): Promise<VoiceTranslateConversation> {
  if (current && current.turns.length > 0) {
    await archiveConversation(current);
  }
  const fresh = createEmptyConversation(sourceLang, targetLang);
  await saveActiveConversation(fresh);
  return fresh;
}

export async function deleteHistoryConversation(id: string): Promise<void> {
  try {
    const history = await listConversationHistory();
    await writeHistory(history.filter((c) => c.id !== id));
  } catch {
    // ignore
  }
}

/**
 * Make a history item the active conversation.
 * Archives the current active first when it has turns and a different id.
 */
export async function restoreHistoryConversation(
  id: string,
  current: VoiceTranslateConversation | null,
): Promise<VoiceTranslateConversation | null> {
  const history = await listConversationHistory();
  const found = history.find((c) => c.id === id);
  if (!found) return null;

  if (current && current.turns.length > 0 && current.id !== found.id) {
    await archiveConversation(current);
  }

  const nextHistory = history.filter((c) => c.id !== id);
  await writeHistory(nextHistory);
  await saveActiveConversation(found);
  return found;
}

export function conversationPreview(conversation: VoiceTranslateConversation): string {
  const first = conversation.turns[0]?.sourceText?.trim();
  if (first) return first.length > 72 ? `${first.slice(0, 69)}…` : first;
  return 'Empty conversation';
}

export function formatConversationForShare(turns: VoiceTranslateTurn[]): string {
  const lines: string[] = ['Voice translate conversation', ''];
  for (const turn of turns) {
    lines.push(`Speaker: ${turn.sourceText}`);
    lines.push(`Translation: ${turn.translatedText}`);
    lines.push('');
  }
  lines.push('— Shared from Smart Transcriber');
  return lines.join('\n');
}

/** @deprecated Prefer loadActiveConversation — kept for callers mid-migration. */
export async function loadConversationDraft(): Promise<VoiceTranslateTurn[]> {
  const active = await loadActiveConversation();
  return active?.turns ?? [];
}

/** @deprecated Prefer saveActiveConversation. */
export async function saveConversationDraft(turns: VoiceTranslateTurn[]): Promise<void> {
  const active = (await loadActiveConversation()) ?? createEmptyConversation();
  await saveActiveConversation({
    ...active,
    turns,
    updatedAt: new Date().toISOString(),
  });
}
