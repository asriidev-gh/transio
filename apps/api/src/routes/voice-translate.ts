import {
  apiSuccess,
  TRANSLATE_LANGUAGE_LABELS,
  TranslateLanguageSchema,
  VoiceTranslateResultSchema,
  type TranslateLanguage,
} from '@sessionai/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { userRateLimit } from '../middleware/rate-limit.js';
import {
  chargeQuota,
  voiceConversationId,
  type QuotaCharge,
} from '../services/quota/index.js';
import { AppError } from '../middleware/error-handler.js';
import { createTranscriptionProvider } from '../providers/transcription/index.js';
import type { TranscriptionProvider } from '../providers/transcription/types.js';
import {
  createTranslateProvider,
  type TranslateProvider,
} from '../providers/translate/index.js';
import { audioUpload } from './audio.js';

const MAX_VOICE_BYTES = 8 * 1024 * 1024;

const VoiceTranslateFieldsSchema = z.object({
  targetLanguage: TranslateLanguageSchema,
  sourceLanguage: z.string().trim().min(2).max(16).optional(),
});

export type TranscriptionProviderFactory = () => TranscriptionProvider;
export type TranslateProviderFactory = () => TranslateProvider;

function sourceLanguageLabel(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const normalized = code.trim().toLowerCase();
  if (normalized === 'auto' || normalized === 'multi') {
    return 'auto-detected (multilingual)';
  }
  if (normalized === 'fil') return TRANSLATE_LANGUAGE_LABELS.tl;
  if (normalized === 'zh-cn' || normalized === 'zh-hans') return TRANSLATE_LANGUAGE_LABELS.zh;
  if (normalized === 'zh-tw') return TRANSLATE_LANGUAGE_LABELS['zh-Hant'];
  const asLang = code.trim() as TranslateLanguage;
  if (asLang in TRANSLATE_LANGUAGE_LABELS) {
    return TRANSLATE_LANGUAGE_LABELS[asLang];
  }
  return code.trim();
}

/** Whisper language hint from our UI codes (omit for auto / unsupported). */
function whisperLanguageHint(code: string | undefined): string | undefined {
  if (!code) return undefined;
  switch (code.trim().toLowerCase()) {
    case 'auto':
    case 'multi':
      return undefined;
    case 'tl':
    case 'fil':
      return 'tl';
    case 'ceb':
      // Whisper has no Cebuano code — let it auto-detect.
      return undefined;
    case 'zh':
    case 'zh-cn':
    case 'zh-hans':
    case 'zh-hant':
    case 'zh-tw':
      return 'zh';
    case 'en':
    case 'es':
    case 'fr':
    case 'de':
    case 'pt':
    case 'it':
    case 'ru':
    case 'ja':
    case 'ko':
    case 'ar':
    case 'hi':
    case 'id':
    case 'ms':
    case 'th':
    case 'vi':
    case 'nl':
    case 'pl':
    case 'tr':
    case 'uk':
    case 'ro':
    case 'sv':
    case 'cs':
    case 'el':
    case 'he':
    case 'fa':
    case 'ur':
    case 'ta':
    case 'te':
    case 'sw':
    case 'bn':
      return code.trim().toLowerCase();
    default:
      // Unknown to Whisper — auto-detect instead of sending a 400-prone code.
      return undefined;
  }
}

/**
 * Push-to-talk interpreter: multipart audio → Whisper → Claude translate.
 * Mounted at `/translate`.
 */
export function createVoiceTranslateRouter(options: {
  createTranscriptionProvider?: TranscriptionProviderFactory;
  createTranslateProvider?: TranslateProviderFactory;
  authenticate?: RequestHandler;
} = {}) {
  const router = Router();
  const authenticate = options.authenticate ?? requireAuth;
  const createTranscription = options.createTranscriptionProvider ?? createTranscriptionProvider;
  const createTranslate = options.createTranslateProvider ?? createTranslateProvider;

  router.use(authenticate);
  router.use(userRateLimit());

  router.post('/voice', audioUpload.single('file'), async (req, res, next) => {
    const started = Date.now();
    let charge: QuotaCharge | undefined;
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const file = req.file;
      if (!file?.buffer?.length) {
        throw new AppError('VALIDATION_ERROR', 'Audio file is required', 400);
      }
      if (file.buffer.byteLength > MAX_VOICE_BYTES) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Clip is too long — keep each turn under ~60 seconds',
          400,
        );
      }

      const fields = VoiceTranslateFieldsSchema.parse({
        targetLanguage: req.body?.targetLanguage,
        sourceLanguage:
          typeof req.body?.sourceLanguage === 'string' && req.body.sourceLanguage.trim()
            ? req.body.sourceLanguage
            : undefined,
      });

      const targetLanguage = fields.targetLanguage as TranslateLanguage;
      const languageLabel = TRANSLATE_LANGUAGE_LABELS[targetLanguage];

      // A whole conversation is charged once, however many turns it has.
      charge = await chargeQuota(req, 'voiceTranslate', {
        conversationId: voiceConversationId(req.headers['x-conversation-id']),
      });

      logger.info('voice-translate start', {
        bytes: file.buffer.byteLength,
        mimeType: file.mimetype,
        targetLanguage,
      });

      const transcription = await createTranscription().transcribe({
        audio: file.buffer,
        mimeType: file.mimetype || 'audio/mp4',
        fileName: file.originalname || 'voice-translate.m4a',
        language: whisperLanguageHint(fields.sourceLanguage),
      });

      const sourceText = transcription.text?.trim() ?? '';
      if (!sourceText) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Could not hear speech — try again closer to the mic',
          400,
        );
      }

      const translatedText = await createTranslate().translateChunk({
        language: targetLanguage,
        languageLabel,
        text: sourceText,
        sourceLanguageLabel: sourceLanguageLabel(
          fields.sourceLanguage ?? transcription.language ?? undefined,
        ),
      });

      logger.info('voice-translate done', {
        ms: Date.now() - started,
        sourceChars: sourceText.length,
        translatedChars: translatedText.trim().length,
      });

      res.status(200).json(
        apiSuccess(
          VoiceTranslateResultSchema.parse({
            sourceText,
            translatedText: translatedText.trim(),
            detectedLanguage: transcription.language ?? null,
            targetLanguage,
            targetLanguageLabel: languageLabel,
          }),
        ),
      );
    } catch (err) {
      await charge?.refund();
      logger.warn('voice-translate failed', {
        ms: Date.now() - started,
        message: err instanceof Error ? err.message : 'unknown',
      });
      next(err);
    }
  });

  return router;
}
