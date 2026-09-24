import type { TranslateLanguage, VoiceTranslateResult } from '@sessionai/shared';
import { mobileEnv } from '@/src/lib/env';
import { getCurrentSession } from '@/src/services/auth';
import { ApiClientError } from '@/src/services/api';

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.webm')) return 'audio/webm';
  if (lower.includes('.wav')) return 'audio/wav';
  if (lower.includes('.mp3')) return 'audio/mpeg';
  if (lower.includes('.m4a') || lower.includes('.caf')) return 'audio/mp4';
  if (lower.startsWith('blob:')) return 'audio/webm';
  return 'audio/mp4';
}

function guessFileName(_uri: string, mimeType: string): string {
  if (mimeType.includes('webm')) return 'voice.webm';
  if (mimeType.includes('wav')) return 'voice.wav';
  if (mimeType.includes('mpeg')) return 'voice.mp3';
  return 'voice.m4a';
}

/** expo-audio sometimes returns a bare filesystem path on Android. */
function normalizeRecordingUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return `file://${trimmed}`;
  return trimmed;
}

const SPEECH_LOCALES: Partial<Record<TranslateLanguage, string>> = {
  en: 'en-US',
  tl: 'fil-PH',
  ceb: 'ceb-PH',
  es: 'es-ES',
  zh: 'zh-CN',
  'zh-Hant': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  it: 'it-IT',
  ru: 'ru-RU',
  ar: 'ar-SA',
  hi: 'hi-IN',
  bn: 'bn-IN',
  id: 'id-ID',
  ms: 'ms-MY',
  th: 'th-TH',
  vi: 'vi-VN',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  uk: 'uk-UA',
  ro: 'ro-RO',
  sv: 'sv-SE',
  cs: 'cs-CZ',
  el: 'el-GR',
  he: 'he-IL',
  fa: 'fa-IR',
  ur: 'ur-PK',
  ta: 'ta-IN',
  te: 'te-IN',
  sw: 'sw-KE',
};

/** Map app language codes to expo-speech BCP-47 locales. */
export function speechLocaleForLanguage(code: TranslateLanguage): string {
  return SPEECH_LOCALES[code] ?? 'en-US';
}

/** Coerce Whisper / UI source codes into a known TranslateLanguage when possible. */
export function asTranslateLanguage(code: string | undefined | null): TranslateLanguage | null {
  if (!code) return null;
  const n = code.trim().toLowerCase();
  if (n === 'auto' || n === 'multi') return null;
  if (n === 'fil' || n === 'fil-ph' || n === 'tl-ph') return 'tl';
  if (n === 'zh-cn' || n === 'zh-hans' || n === 'cmn-hans') return 'zh';
  if (n === 'zh-tw' || n === 'zh-hk' || n === 'zh-hant' || n === 'cmn-hant') return 'zh-Hant';
  if (n in SPEECH_LOCALES) return n as TranslateLanguage;
  const base = n.split(/[-_]/)[0] ?? n;
  if (base in SPEECH_LOCALES) return base as TranslateLanguage;
  return null;
}

/** Locale for speaker-side TTS from a selected or detected source language code. */
export function speechLocaleForCode(code: string | undefined | null): string {
  const known = asTranslateLanguage(code);
  if (known) return speechLocaleForLanguage(known);
  if (!code || code.trim().toLowerCase() === 'auto') return 'en-US';
  const trimmed = code.trim();
  // Pass through BCP-47-ish tags; otherwise use the bare code and let the OS pick.
  return trimmed.includes('-') || trimmed.includes('_') ? trimmed.replace(/_/g, '-') : trimmed;
}

/**
 * Locale tags that may appear on device TTS voices for a given Phone-says language.
 * Used to auto-select a matching translator voice.
 */
export function speechLocaleCandidates(language: TranslateLanguage): string[] {
  const primary = speechLocaleForLanguage(language).toLowerCase();
  const prefix = primary.split('-')[0] ?? 'en';
  const tags = new Set<string>([primary, prefix]);

  switch (language) {
    case 'tl':
      tags.add('fil');
      tags.add('fil-ph');
      tags.add('tl');
      tags.add('tl-ph');
      break;
    case 'ceb':
      tags.add('ceb');
      tags.add('ceb-ph');
      // Closest installed voices are often Filipino/Tagalog.
      tags.add('fil');
      tags.add('fil-ph');
      tags.add('tl');
      break;
    case 'zh':
      tags.add('zh');
      tags.add('zh-cn');
      tags.add('zh-hans');
      tags.add('cmn');
      tags.add('cmn-hans');
      break;
    case 'zh-Hant':
      tags.add('zh');
      tags.add('zh-tw');
      tags.add('zh-hk');
      tags.add('zh-hant');
      tags.add('cmn-hant');
      break;
    case 'pt':
      tags.add('pt-br');
      tags.add('pt-pt');
      break;
    default:
      break;
  }

  return [...tags];
}

export function voiceMatchesLanguage(
  voiceLanguage: string,
  target: TranslateLanguage,
  voiceName?: string,
): boolean {
  const lang = voiceLanguage.trim().toLowerCase().replace(/_/g, '-');
  if (lang) {
    const hit = speechLocaleCandidates(target).some(
      (tag) => lang === tag || lang.startsWith(`${tag}-`) || lang.startsWith(tag),
    );
    if (hit) return true;
  }

  // Some Android voices report a generic language but put Filipino/Tagalog in the name.
  const name = (voiceName ?? '').toLowerCase();
  if (!name) return false;
  const nameHints: Partial<Record<TranslateLanguage, string[]>> = {
    tl: ['filipino', 'tagalog', 'fil-ph', 'fil_ph', 'tl-ph'],
    ceb: ['cebuano', 'bisaya', 'filipino', 'tagalog'],
    en: ['english', 'en-us', 'en-gb', 'en-au'],
    es: ['spanish', 'español', 'espanol'],
    zh: ['chinese', 'mandarin', 'zh-cn'],
    'zh-Hant': ['taiwan', 'cantonese', 'zh-tw', 'zh-hk'],
    ja: ['japanese', 'japan'],
    ko: ['korean'],
    fr: ['french', 'français', 'francais'],
    de: ['german', 'deutsch'],
    pt: ['portuguese', 'português', 'brazil'],
  };
  return (nameHints[target] ?? []).some((hint) => name.includes(hint));
}

function apiHostHint(): string {
  try {
    return new URL(mobileEnv.apiBaseUrl).host;
  } catch {
    return mobileEnv.apiBaseUrl || 'unknown';
  }
}

/**
 * Upload a short push-to-talk clip → Whisper STT + Claude translation.
 * Uses XHR (same as session audio upload) — more reliable for RN multipart files than fetch.
 */
export async function translateVoiceClip(input: {
  localUri: string;
  targetLanguage: TranslateLanguage;
  sourceLanguage?: string;
}): Promise<VoiceTranslateResult> {
  const token = (await getCurrentSession())?.access_token;
  if (!token) {
    throw new ApiClientError('UNAUTHORIZED', 'You must be signed in.', 401);
  }

  const localUri = normalizeRecordingUri(input.localUri);
  const mimeType = guessMimeType(localUri);
  const fileName = guessFileName(localUri, mimeType);
  const form = new FormData();

  if (
    localUri.startsWith('blob:') ||
    localUri.startsWith('http') ||
    localUri.startsWith('data:')
  ) {
    const res = await fetch(localUri);
    const blob = await res.blob();
    form.append('file', blob, fileName);
  } else {
    form.append('file', {
      uri: localUri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
  }

  form.append('targetLanguage', input.targetLanguage);
  if (input.sourceLanguage) {
    form.append('sourceLanguage', input.sourceLanguage);
  }

  const url = `${mobileEnv.apiBaseUrl.replace(/\/$/, '')}/translate/voice`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = 90_000;

    xhr.onload = () => {
      const text = xhr.responseText ?? '';
      let body:
        | { success: true; data: VoiceTranslateResult }
        | { success: false; error: { code: string; message: string } };
      try {
        body = JSON.parse(text) as typeof body;
      } catch {
        reject(
          new ApiClientError(
            'INVALID_RESPONSE',
            `The API returned a non-JSON response (${xhr.status}).`,
            xhr.status,
          ),
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && body.success) {
        resolve(body.data);
        return;
      }

      const err = body as { success: false; error: { code: string; message: string } };
      const code = err.error?.code ?? 'REQUEST_FAILED';
      let message = err.error?.message ?? 'Voice translate failed.';
      if (xhr.status === 404 || code === 'NOT_FOUND') {
        message =
          'Voice translate API is missing on the server. Redeploy the API (POST /translate/voice), then try again.';
      }
      reject(new ApiClientError(code, message, xhr.status));
    };

    xhr.onerror = () => {
      reject(
        new ApiClientError(
          'NETWORK_ERROR',
          `Unable to reach the API at ${apiHostHint()}. Check Wi‑Fi and that npm run api is running.`,
          0,
        ),
      );
    };

    xhr.ontimeout = () => {
      reject(
        new ApiClientError(
          'NETWORK_ERROR',
          'Voice translate timed out. Try a shorter clip, or check the API / OpenAI key.',
          0,
        ),
      );
    };

    xhr.send(form);
  });
}
