import {
  apiSuccess,
  SessionIdParamSchema,
  SummarizeAcceptedSchema,
  SummaryRecordSchema,
} from '@sessionai/shared';
import type { Request, Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { createSupabaseUserClient } from '../lib/supabase.js';
import { createSummaryProvider } from '../providers/summary/index.js';
import type { SummaryProvider } from '../providers/summary/types.js';
import type { SessionRepoFactory } from './sessions.js';
import { runSummaryJob } from '../services/summary/job.js';
import {
  SupabaseSummaryRepository,
  type SummaryRepository,
} from '../services/summaries/repository.js';
import {
  SupabaseTranscriptRepository,
  type TranscriptRepository,
} from '../services/transcripts/repository.js';
import type { TranscriptRepoFactory } from './transcription.js';

export type SummaryRepoFactory = (req: Request) => SummaryRepository;
export type SummaryProviderFactory = () => SummaryProvider;
export type SummaryJobRunner = (sessionId: string, req: Request) => void;

function defaultSummaryRepoFactory(req: Request): SummaryRepository {
  if (!req.accessToken) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return new SupabaseSummaryRepository(createSupabaseUserClient(req.accessToken));
}

function defaultTranscriptRepoFactory(req: Request): TranscriptRepository {
  if (!req.accessToken) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return new SupabaseTranscriptRepository(createSupabaseUserClient(req.accessToken));
}

function defaultJobRunner(
  createRepository: SessionRepoFactory,
  createTranscriptRepository: TranscriptRepoFactory,
  createSummaryRepository: SummaryRepoFactory,
  createProvider: SummaryProviderFactory,
): SummaryJobRunner {
  return (sessionId, req) => {
    if (!req.user || !req.accessToken) {
      return;
    }

    const userId = req.user.id;

    void runSummaryJob(sessionId, {
      userId,
      sessions: createRepository(req),
      transcripts: createTranscriptRepository(req),
      summaries: createSummaryRepository(req),
      provider: createProvider(),
    });
  };
}

export function registerSummaryRoutes(
  router: Router,
  options: {
    createRepository: SessionRepoFactory;
    createTranscriptRepository?: TranscriptRepoFactory;
    createSummaryRepository?: SummaryRepoFactory;
    createProvider?: SummaryProviderFactory;
    runJob?: SummaryJobRunner;
  },
): void {
  const createTranscriptRepository =
    options.createTranscriptRepository ?? defaultTranscriptRepoFactory;
  const createSummaryRepository =
    options.createSummaryRepository ?? defaultSummaryRepoFactory;
  const createProvider = options.createProvider ?? createSummaryProvider;
  const runJob =
    options.runJob ??
    defaultJobRunner(
      options.createRepository,
      createTranscriptRepository,
      createSummaryRepository,
      createProvider,
    );

  router.post('/:id/summarize', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const transcript = await createTranscriptRepository(req).getBySessionId(id);
      if (!transcript?.text?.trim()) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Generate a transcript before starting summarization',
          400,
        );
      }

      if (session.status === 'summarizing') {
        res.status(202).json(
          apiSuccess(
            SummarizeAcceptedSchema.parse({
              sessionId: id,
              status: 'summarizing',
            }),
          ),
        );
        return;
      }

      if (
        session.status === 'recording' ||
        session.status === 'uploaded' ||
        session.status === 'transcribing'
      ) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Generate a transcript before starting summarization',
          400,
        );
      }

      createProvider();

      const updated = await options.createRepository(req).update(req.user.id, id, {
        status: 'summarizing',
      });
      if (!updated) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      runJob(id, req);

      res.status(202).json(
        apiSuccess(
          SummarizeAcceptedSchema.parse({
            sessionId: id,
            status: 'summarizing',
          }),
        ),
      );
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/summary', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const summary = await createSummaryRepository(req).getBySessionId(id);
      if (!summary) {
        throw new AppError('NOT_FOUND', 'Summary not found', 404);
      }

      res.status(200).json(apiSuccess(SummaryRecordSchema.parse(summary)));
    } catch (err) {
      next(err);
    }
  });
}
