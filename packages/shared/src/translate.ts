import { z } from 'zod';
import { SessionSummarySchema, SummaryKindSchema, type SessionSummary } from './summary.js';
import { TranscriptSegmentSchema, type TranscriptSegment } from './transcript.js';

/** Curated target languages for the Translate select (global coverage). */
export const TRANSLATE_LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'tl', label: 'Filipino' },
  { code: 'ceb', label: 'Cebuano' },
  { code: 'es', label: 'Spanish' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'zh-Hant', label: 'Chinese (Traditional)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ms', label: 'Malay' },
  { code: 'th', label: 'Thai' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ro', label: 'Romanian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'cs', label: 'Czech' },
  { code: 'el', label: 'Greek' },
  { code: 'he', label: 'Hebrew' },
  { code: 'fa', label: 'Persian' },
  { code: 'ur', label: 'Urdu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'sw', label: 'Swahili' },
] as const;

export const TranslateLanguageSchema = z.enum(
  TRANSLATE_LANGUAGE_OPTIONS.map((o) => o.code) as [
    (typeof TRANSLATE_LANGUAGE_OPTIONS)[number]['code'],
    ...(typeof TRANSLATE_LANGUAGE_OPTIONS)[number]['code'][],
  ],
);
export type TranslateLanguage = z.infer<typeof TranslateLanguageSchema>;

export const TRANSLATE_LANGUAGE_LABELS: Record<TranslateLanguage, string> =
  Object.fromEntries(
    TRANSLATE_LANGUAGE_OPTIONS.map((o) => [o.code, o.label]),
  ) as Record<TranslateLanguage, string>;

export const TranslateScopeSchema = z.enum(['summary', 'transcript']);
export type TranslateScope = z.infer<typeof TranslateScopeSchema>;

export const TranslateRequestSchema = z.object({
  language: TranslateLanguageSchema,
  scope: TranslateScopeSchema,
  /** When scope is summary, which structured document to translate. */
  summaryKind: SummaryKindSchema.optional(),
});

export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

export const TranslatedSummarySchema = SessionSummarySchema.extend({
  quotes: z.array(z.string()).default([]),
});

export type TranslatedSummary = z.infer<typeof TranslatedSummarySchema>;

export const TranslatedTranscriptSchema = z.object({
  text: z.string().min(1),
  segments: z.array(TranscriptSegmentSchema).default([]),
});

export type TranslatedTranscript = z.infer<typeof TranslatedTranscriptSchema>;

export const TranslateResultSchema = z.object({
  language: TranslateLanguageSchema,
  languageLabel: z.string(),
  scope: TranslateScopeSchema,
  summary: TranslatedSummarySchema.optional(),
  transcript: TranslatedTranscriptSchema.optional(),
});

export type TranslateResult = z.infer<typeof TranslateResultSchema>;

/** Short live-caption chunk translation (during recording). */
export const LiveTranslateChunkRequestSchema = z.object({
  text: z.string().trim().min(1).max(4_000),
  language: TranslateLanguageSchema,
  /** Optional BCP-47 / Deepgram source hint for better translation. */
  sourceLanguage: z.string().trim().min(2).max(16).optional(),
});

export type LiveTranslateChunkRequest = z.infer<typeof LiveTranslateChunkRequestSchema>;

export const LiveTranslateChunkResultSchema = z.object({
  language: TranslateLanguageSchema,
  languageLabel: z.string(),
  text: z.string().min(1),
});

export type LiveTranslateChunkResult = z.infer<typeof LiveTranslateChunkResultSchema>;

/** Push-to-talk voice interpreter: audio in → transcribed + translated text out. */
export const VoiceTranslateResultSchema = z.object({
  sourceText: z.string().min(1),
  translatedText: z.string().min(1),
  detectedLanguage: z.string().nullable().optional(),
  targetLanguage: TranslateLanguageSchema,
  targetLanguageLabel: z.string(),
});

export type VoiceTranslateResult = z.infer<typeof VoiceTranslateResultSchema>;

export type { SessionSummary, TranscriptSegment };
