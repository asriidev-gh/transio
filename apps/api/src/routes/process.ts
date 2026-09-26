import {
  apiSuccess,
  isNotesOnlyCaptureMode,
  ProcessAcceptedSchema,
  SessionIdParamSchema,
} from '@sessionai/shared';
import type { Request, Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import {
  createSupabaseUserClient,
  getJobSupabaseClient,
  getSupabaseServiceClient,
} from '../lib/supabase.js';
import { enqueueJob } from '../lib/job-queue.js';
import { SupabaseSessionRepository } from '../services/sessions/repository.js';
import { logger } from '../lib/logger.js';
import { createSummaryProvider } from '../providers/summary/index.js';
import type { SummaryProvider } from '../providers/summary/types.js';
import { createTranscriptionProvider } from '../providers/transcription/index.js';
import type { TranscriptionProvider } from '../providers/transcription/types.js';
import {
  createSupabaseAudioDownloader,
  createSupabaseAudioRemover,
} from '../services/transcription/job.js';
import { runProcessingPipeline } from '../services/processing/job.js';
import {
  SupabaseSummaryRepository,
  type SummaryRepository,
} from '../services/summaries/repository.js';
import {
  SupabaseTranscriptRepository,
  type TranscriptRepository,
} from '../services/transcripts/repository.js';
import type { SessionRepoFactory } from './sessions.js';
import type { SummaryProviderFactory, SummaryRepoFactory } from './summary.js';
import type {
  TranscriptRepoFactory,
  TranscriptionProviderFactory,
} from './transcription.js';

export type ProcessJobRunner = (sessionId: string, req: Request) => void;

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

function defaultProcessJobRunner(
  createTranscriptionProviderFn: TranscriptionProviderFactory,
  createSummaryProviderFn: SummaryProviderFactory,
): ProcessJobRunner {
  return (sessionId, req) => {
    if (!req.user || !req.accessToken) {
      return;
    }

    const userId = req.user.id;
    const client = getSupabaseServiceClient();

    const jobClient = getJobSupabaseClient(req.accessToken);
    const sessions = new SupabaseSessionRepository(jobClient);
    const transcripts = new SupabaseTranscriptRepository(jobClient);
    const summaries = new SupabaseSummaryRepository(jobClient);
    const transcriptionProvider = createTranscriptionProviderFn();
    const summaryProvider = createSummaryProviderFn();
    enqueueJob('process', () =>
      runProcessingPipeline(sessionId, {
        userId,
        sessions,
        transcripts,
        summaries,
        transcriptionProvider,
        summaryProvider,
        downloadAudio: createSupabaseAudioDownloader(client),
        removeAudio: createSupabaseAudioRemover(client),
      }),
    );
  };
}

function resolveAcceptedStage(status: 'transcribing' | 'summarizing' | 'completed') {
  if (status === 'completed') return 'done' as const;
  if (status === 'summarizing') return 'summarize' as const;
  return 'transcribe' as const;
}

/**
 * Ensures both STT and Claude providers are configured before starting the pipeline.
 */
export function ensureProcessingProviders(
  createTranscriptionProviderFn: TranscriptionProviderFactory = createTranscriptionProvider,
  createSummaryProviderFn: SummaryProviderFactory = createSummaryProvider,
): { transcription: TranscriptionProvider; summary: SummaryProvider } {
  return {
    transcription: createTranscriptionProviderFn(),
    summary: createSummaryProviderFn(),
  };
}

export function registerProcessRoutes(
  router: Router,
  options: {
    createRepository: SessionRepoFactory;
    createTranscriptRepository?: TranscriptRepoFactory;
    createSummaryRepository?: SummaryRepoFactory;
    createTranscriptionProvider?: TranscriptionProviderFactory;
    createSummaryProvider?: SummaryProviderFactory;
    runJob?: ProcessJobRunner;
  },
): void {
  const createTranscriptRepository =
    options.createTranscriptRepository ?? defaultTranscriptRepoFactory;
  const createSummaryRepository =
    options.createSummaryRepository ?? defaultSummaryRepoFactory;
  const createTranscriptionProviderFn =
    options.createTranscriptionProvider ?? createTranscriptionProvider;
  const createSummaryProviderFn = options.createSummaryProvider ?? createSummaryProvider;
  const runJob =
    options.runJob ??
    defaultProcessJobRunner(createTranscriptionProviderFn, createSummaryProviderFn);

  router.post('/:id/process', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }
      if (!session.audioPath) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Upload audio before starting processing',
          400,
        );
      }

      if (session.status === 'transcribing' || session.status === 'summarizing') {
        res.status(202).json(
          apiSuccess(
            ProcessAcceptedSchema.parse({
              sessionId: id,
              status: session.status,
              stage: resolveAcceptedStage(session.status),
            }),
          ),
        );
        return;
      }

      if (session.status === 'completed' || session.status === 'transcribed') {
        const [notes, summary, transcript] = await Promise.all([
          createSummaryRepository(req).getBySessionId(id, 'notes').catch(() => null),
          createSummaryRepository(req).getBySessionId(id, 'ai_summary').catch(() => null),
          createTranscriptRepository(req).getBySessionId(id).catch(() => null),
        ]);
        if (notes || summary || transcript || session.status === 'completed') {
          res.status(200).json(
            apiSuccess(
              ProcessAcceptedSchema.parse({
                sessionId: id,
                status: session.status === 'transcribed' ? 'transcribed' : 'completed',
                stage: 'done',
              }),
            ),
          );
          return;
        }
      }

      ensureProcessingProviders(createTranscriptionProviderFn, createSummaryProviderFn);

      const transcript = await createTranscriptRepository(req).getBySessionId(id);
      const notesOnly = isNotesOnlyCaptureMode(session.captureMode);

      // Non-notes sessions with a transcript are done — AI summary is opt-in.
      if (!notesOnly && transcript?.text?.trim()) {
        if (session.status !== 'transcribed') {
          await options.createRepository(req).update(req.user.id, id, {
            status: 'transcribed',
          });
        }
        res.status(200).json(
          apiSuccess(
            ProcessAcceptedSchema.parse({
              sessionId: id,
              status: 'transcribed',
              stage: 'done',
            }),
          ),
        );
        return;
      }

      const nextStatus =
        notesOnly && transcript?.text?.trim() ? 'summarizing' : 'transcribing';

      const updated = await options.createRepository(req).update(req.user.id, id, {
        status: nextStatus,
      });
      if (!updated) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      runJob(id, req);

      res.status(202).json(
        apiSuccess(
          ProcessAcceptedSchema.parse({
            sessionId: id,
            status: nextStatus,
            stage: resolveAcceptedStage(nextStatus),
          }),
        ),
      );
    } catch (err) {
      next(err);
    }
  });
}

/**
 * Best-effort auto-start of the processing pipeline after a successful upload.
 * Upload itself must already have succeeded; provider misconfiguration is logged and skipped.
 */
export function tryStartProcessingAfterUpload(
  sessionId: string,
  req: Request,
  options: {
    createRepository: SessionRepoFactory;
    runJob: ProcessJobRunner;
    createTranscriptionProvider?: TranscriptionProviderFactory;
    createSummaryProvider?: SummaryProviderFactory;
  },
): void {
  try {
    if (!req.user) return;
    const userId = req.user.id;

    void (async () => {
      const session = await options.createRepository(req).getById(userId, sessionId);
      if (!session) return;

      // Live Note Taker already saved bullets on stop — never re-run STT on upload.
      if (session.captureMode === 'live_notes') {
        if (session.status !== 'completed') {
          await options.createRepository(req).update(userId, sessionId, {
            status: 'completed',
          });
        }
        return;
      }

      ensureProcessingProviders(
        options.createTranscriptionProvider ?? createTranscriptionProvider,
        options.createSummaryProvider ?? createSummaryProvider,
      );

      await options.createRepository(req).update(userId, sessionId, {
        status: 'transcribing',
      });
      options.runJob(sessionId, req);
    })().catch((err) => {
      logger.warn('Auto-process after upload failed', {
        sessionId,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    });
  } catch (err) {
    logger.warn('Auto-process skipped after upload (providers not configured)', {
      sessionId,
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
