import {
  apiSuccess,
  SessionIdParamSchema,
  SummarizeAcceptedSchema,
  SummaryRecordSchema,
} from '@sessionai/shared';
import type { Request, Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { createSupabaseUserClient, getJobSupabaseClient } from '../lib/supabase.js';
import { enqueueJob } from '../lib/job-queue.js';
import { chargeQuota } from '../services/quota/index.js';
import { SupabaseSessionRepository } from '../services/sessions/repository.js';
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

function defaultJobRunner(createProvider: SummaryProviderFactory): SummaryJobRunner {
  return (sessionId, req) => {
    if (!req.user || !req.accessToken) {
      return;
    }

    const userId = req.user.id;

    const jobClient = getJobSupabaseClient(req.accessToken);
    const sessions = new SupabaseSessionRepository(jobClient);
    const transcripts = new SupabaseTranscriptRepository(jobClient);
    const summaries = new SupabaseSummaryRepository(jobClient);
    const provider = createProvider();

    enqueueJob('summary', () =>
      runSummaryJob(sessionId, { userId, sessions, transcripts, summaries, provider }),
    );
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
    defaultJobRunner(createProvider);

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
      const notes = await createSummaryRepository(req).getBySessionId(id, 'notes');
      const hasSource = Boolean(transcript?.text?.trim() || notes);
      if (!hasSource) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Capture notes or a transcript before starting summarization',
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
          'Finish capture or transcription before starting summarization',
          400,
        );
      }

      createProvider();

      // Charged only once the request is valid and a new summary is really starting.
      const charge = await chargeQuota(req, 'summary');
      try {
        const updated = await options.createRepository(req).update(req.user.id, id, {
          status: 'summarizing',
        });
        if (!updated) {
          throw new AppError('NOT_FOUND', 'Session not found', 404);
        }

        runJob(id, req);
      } catch (err) {
        await charge.refund();
        throw err;
      }

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

      const summary = await createSummaryRepository(req).getBySessionId(id, 'ai_summary');
      if (!summary) {
        throw new AppError('NOT_FOUND', 'Summary not found', 404);
      }

      res.status(200).json(apiSuccess(SummaryRecordSchema.parse(summary)));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/notes', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      let notes = await createSummaryRepository(req).getBySessionId(id, 'notes');
      // Older finalize writes used the default kind before `notes` existed.
      if (!notes && (session.captureMode === 'notes' || session.captureMode === 'live_notes')) {
        notes = await createSummaryRepository(req).getBySessionId(id, 'ai_summary');
      }
      if (!notes) {
        throw new AppError('NOT_FOUND', 'Notes not found', 404);
      }

      res.status(200).json(apiSuccess(SummaryRecordSchema.parse(notes)));
    } catch (err) {
      next(err);
    }
  });
}
