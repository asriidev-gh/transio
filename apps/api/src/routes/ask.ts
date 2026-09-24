import {
  apiSuccess,
  AskAnswerSchema,
  AskQuestionSchema,
  SessionIdParamSchema,
} from '@sessionai/shared';
import type { Request, Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { createSupabaseUserClient } from '../lib/supabase.js';
import { createAskProvider, type AskProvider } from '../providers/ask/index.js';
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

export type AskProviderFactory = () => AskProvider;

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

function buildSummaryContext(summary: {
  overview: string | null;
  keyPoints: string[];
  actionItems: Array<{ task: string; details?: string }>;
  importantInsights: string[];
}): string {
  const lines: string[] = [];
  if (summary.overview) lines.push(`Overview: ${summary.overview}`);
  if (summary.keyPoints.length) lines.push(`Key points:\n- ${summary.keyPoints.join('\n- ')}`);
  if (summary.actionItems.length) {
    lines.push(
      `Action items:\n- ${summary.actionItems.map((a) => a.task).join('\n- ')}`,
    );
  }
  if (summary.importantInsights.length) {
    lines.push(`Insights:\n- ${summary.importantInsights.join('\n- ')}`);
  }
  return lines.join('\n\n');
}

export function registerAskRoutes(
  router: Router,
  options: {
    createRepository: SessionRepoFactory;
    createTranscriptRepository?: TranscriptRepoFactory;
    createSummaryRepository?: SummaryRepoFactory;
    createAskProvider?: AskProviderFactory;
  },
): void {
  const createTranscriptRepository =
    options.createTranscriptRepository ?? defaultTranscriptRepoFactory;
  const createSummaryRepository =
    options.createSummaryRepository ?? defaultSummaryRepoFactory;
  const createProvider = options.createAskProvider ?? createAskProvider;

  router.post('/:id/ask', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const { question } = AskQuestionSchema.parse(req.body);

      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const transcript = await createTranscriptRepository(req).getBySessionId(id);
      if (!transcript?.text) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Generate a transcript before asking about this session.',
          400,
        );
      }

      let summaryContext: string | undefined;
      try {
        const summary =
          (await createSummaryRepository(req).getBySessionId(id, 'ai_summary')) ??
          (await createSummaryRepository(req).getBySessionId(id, 'notes'));
        if (summary) {
          summaryContext = buildSummaryContext(summary);
        }
      } catch {
        // Summary is optional for ask.
      }

      const result = await createProvider().ask({
        question,
        title: session.title,
        sessionType: session.sessionType,
        transcriptText: transcript.text,
        summaryContext,
      });

      const payload = AskAnswerSchema.parse(result);
      res.status(200).json(apiSuccess(payload));
    } catch (err) {
      next(err);
    }
  });
}
