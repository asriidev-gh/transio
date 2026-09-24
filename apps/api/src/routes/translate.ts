import {
  apiSuccess,
  LiveTranslateChunkRequestSchema,
  LiveTranslateChunkResultSchema,
  SessionIdParamSchema,
  TRANSLATE_LANGUAGE_LABELS,
  TranslateRequestSchema,
  TranslateResultSchema,
  type TranslatedSummary,
} from '@sessionai/shared';
import type { Request, Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  createTranslateProvider,
  type TranslateProvider,
} from '../providers/translate/index.js';
import {
  SupabaseSummaryRepository,
  type SummaryRepository,
} from '../services/summaries/repository.js';
import {
  SupabaseTranscriptRepository,
  type TranscriptRepository,
} from '../services/transcripts/repository.js';
import type { SessionRepoFactory } from './sessions.js';
import type { SummaryRepoFactory } from './summary.js';
import type { TranscriptRepoFactory } from './transcription.js';

export type TranslateProviderFactory = () => TranslateProvider;

/** Map live-caption / BCP-47 codes to a short Claude source hint. */
function sourceLanguageLabel(code: string | undefined): string | undefined {
  if (!code) return undefined;
  switch (code.trim().toLowerCase()) {
    case 'multi':
      return 'auto-detected (multilingual)';
    case 'tl':
    case 'fil':
      return 'Tagalog / Filipino';
    case 'en':
      return 'English';
    case 'zh':
    case 'zh-cn':
    case 'zh-hans':
      return 'Chinese';
    case 'zh-hant':
    case 'zh-tw':
      return 'Traditional Chinese';
    case 'es':
      return 'Spanish';
    case 'ja':
      return 'Japanese';
    case 'ko':
      return 'Korean';
    default:
      return code.trim();
  }
}

function defaultTranscriptRepoFactory(req: Request): TranscriptRepository {
  if (!req.accessToken) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return new SupabaseTranscriptRepository(createSupabaseUserClient(req.accessToken));
}

function defaultSummaryRepoFactory(req: Request): SummaryRepository {
  if (!req.accessToken) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return new SupabaseSummaryRepository(createSupabaseUserClient(req.accessToken));
}

function toTranslatedSummary(summary: {
  overview: string | null;
  keyPoints: string[];
  topics: Array<{ title: string; summary: string }>;
  questionsDiscussed: string[];
  actionItems: Array<{ task: string; details?: string }>;
  importantInsights: string[];
  quotes: string[];
}): TranslatedSummary {
  return {
    overview: summary.overview ?? '',
    keyPoints: summary.keyPoints,
    topics: summary.topics,
    questionsDiscussed: summary.questionsDiscussed,
    actionItems: summary.actionItems,
    importantInsights: summary.importantInsights,
    quotes: summary.quotes ?? [],
  };
}

export function registerTranslateRoutes(
  router: Router,
  options: {
    createRepository: SessionRepoFactory;
    createTranscriptRepository?: TranscriptRepoFactory;
    createSummaryRepository?: SummaryRepoFactory;
    createTranslateProvider?: TranslateProviderFactory;
  },
): void {
  const createTranscriptRepository =
    options.createTranscriptRepository ?? defaultTranscriptRepoFactory;
  const createSummaryRepository =
    options.createSummaryRepository ?? defaultSummaryRepoFactory;
  const createProvider = options.createTranslateProvider ?? createTranslateProvider;

  router.post('/:id/translate', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const { language, scope, summaryKind } = TranslateRequestSchema.parse(req.body);
      const languageLabel = TRANSLATE_LANGUAGE_LABELS[language];

      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const provider = createProvider();

      if (scope === 'summary') {
        let summary = summaryKind
          ? await createSummaryRepository(req).getBySessionId(id, summaryKind)
          : null;
        if (!summary) {
          summary =
            (await createSummaryRepository(req).getBySessionId(id, 'ai_summary')) ??
            (await createSummaryRepository(req).getBySessionId(id, 'notes'));
        }
        if (!summary) {
          throw new AppError(
            'VALIDATION_ERROR',
            'Generate notes or a summary before translating.',
            400,
          );
        }

        const translated = await provider.translateSummary({
          language,
          languageLabel,
          summary: toTranslatedSummary(summary),
        });

        const payload = TranslateResultSchema.parse({
          language,
          languageLabel,
          scope,
          summary: translated,
        });
        res.status(200).json(apiSuccess(payload));
        return;
      }

      const transcript = await createTranscriptRepository(req).getBySessionId(id);
      if (!transcript?.text) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Generate a transcript before translating.',
          400,
        );
      }

      const translated = await provider.translateTranscript({
        language,
        languageLabel,
        text: transcript.text,
        segments: transcript.segments ?? [],
      });

      const payload = TranslateResultSchema.parse({
        language,
        languageLabel,
        scope,
        transcript: translated,
      });
      res.status(200).json(apiSuccess(payload));
    } catch (err) {
      next(err);
    }
  });

  /** Translate a short live-caption chunk during recording. */
  router.post('/:id/translate-live', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const body = LiveTranslateChunkRequestSchema.parse(req.body);
      const languageLabel = TRANSLATE_LANGUAGE_LABELS[body.language];

      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const provider = createProvider();
      const text = await provider.translateChunk({
        language: body.language,
        languageLabel,
        text: body.text,
        sourceLanguageLabel: sourceLanguageLabel(body.sourceLanguage),
      });

      res.status(200).json(
        apiSuccess(
          LiveTranslateChunkResultSchema.parse({
            language: body.language,
            languageLabel,
            text,
          }),
        ),
      );
    } catch (err) {
      next(err);
    }
  });
}
