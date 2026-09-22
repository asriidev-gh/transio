import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TRANSLATE_LANGUAGE_LABELS,
  TRANSLATE_LANGUAGE_OPTIONS,
  type LiveTranslateChunkResult,
  type TranslateLanguage,
} from '@sessionai/shared';
import { apiRequest } from './api';
import type { LiveCaptionLanguage } from './live-captions';

const TARGET_PREF_KEY = 'live-translate-target';

/** Compact set for live recording chips (full list still used in TranslateBar). */
export const LIVE_TRANSLATE_TARGET_OPTIONS: Array<{
  code: TranslateLanguage | null;
  label: string;
}> = [
  { code: null, label: 'Off' },
  { code: 'en', label: 'English' },
  { code: 'tl', label: 'Filipino' },
  { code: 'zh', label: 'Chinese' },
  { code: 'zh-Hant', label: 'Chinese (Trad.)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'es', label: 'Spanish' },
];

export async function getLiveTranslateTargetPref(): Promise<TranslateLanguage | null> {
  try {
    const raw = await AsyncStorage.getItem(TARGET_PREF_KEY);
    if (!raw || raw === 'off') return null;
    if (TRANSLATE_LANGUAGE_OPTIONS.some((o) => o.code === raw)) {
      return raw as TranslateLanguage;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function setLiveTranslateTargetPref(
  language: TranslateLanguage | null,
): Promise<void> {
  try {
    await AsyncStorage.setItem(TARGET_PREF_KEY, language ?? 'off');
  } catch {
    // ignore
  }
}

/** Same-language pairs should not round-trip through Claude. */
export function isSameLiveLanguage(
  source: LiveCaptionLanguage,
  target: TranslateLanguage,
): boolean {
  if (source === 'multi') return false;
  if (source === target) return true;
  if (source === 'zh' && (target === 'zh' || target === 'zh-Hant')) return true;
  if (source === 'tl' && target === 'tl') return true;
  return false;
}

export async function translateLiveChunk(
  sessionId: string,
  text: string,
  language: TranslateLanguage,
  sourceLanguage: LiveCaptionLanguage,
): Promise<LiveTranslateChunkResult> {
  return apiRequest<LiveTranslateChunkResult>(`/sessions/${sessionId}/translate-live`, {
    method: 'POST',
    auth: true,
    body: {
      text,
      language,
      // BCP-47 / Deepgram code (e.g. multi, tl) — not a human label
      sourceLanguage,
    },
    retries: 1,
  });
}

export function liveTranslateTargetLabel(language: TranslateLanguage | null): string {
  if (!language) return 'Off';
  return TRANSLATE_LANGUAGE_LABELS[language] ?? language;
}
