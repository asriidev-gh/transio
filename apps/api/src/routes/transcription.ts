import {
  apiSuccess,
  SessionIdParamSchema,
  SessionStatusResponseSchema,
  TranscribeAcceptedSchema,
  TranscriptSchema,
} from '@sessionai/shared';
import type { Request, Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { createSupabaseUserClient } from '../lib/supabase.js';
import { createTranscriptionProvider } from '../providers/transcription/index.js';
import type { TranscriptionProvider } from '../providers/transcription/types.js';
import type { SessionRepoFactory } from './sessions.js';
import {
  createSupabaseAudioDownloader,
  runTranscriptionJob,
} from '../services/transcription/job.js';
import {
  SupabaseTranscriptRepository,
  type TranscriptRepository,
} from '../services/transcripts/repository.js';
import {
  SupabaseSummaryRepository,
  type SummaryRepository,
} from '../services/summaries/repository.js';

export type TranscriptRepoFactory = (req: Request) => TranscriptRepository;
export type TranscriptionProviderFactory = () => TranscriptionProvider;
export type JobRunner = (sessionId: string, req: Request) => void;
export type SummaryRepoFactoryForStatus = (req: Request) => SummaryRepository;

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

function defaultJobRunner(
  createRepository: SessionRepoFactory,
  createTranscriptRepository: TranscriptRepoFactory,
  createProvider: TranscriptionProviderFactory,
): JobRunner {
  return (sessionId, req) => {
    if (!req.user || !req.accessToken) {
      return;
    }

    const userId = req.user.id;
    const accessToken = req.accessToken;
    const client = createSupabaseUserClient(accessToken);

    // Fire-and-forget async job (queue can replace this later).
    void runTranscriptionJob(sessionId, {
      userId,
      sessions: createRepository(req),
      transcripts: createTranscriptRepository(req),
      provider: createProvider(),
      downloadAudio: createSupabaseAudioDownloader(client),
    });
  };
}

export function registerTranscriptionRoutes(
  router: Router,
  options: {
    createRepository: SessionRepoFactory;
    createTranscriptRepository?: TranscriptRepoFactory;
    createSummaryRepository?: SummaryRepoFactoryForStatus;
    createProvider?: TranscriptionProviderFactory;
    runJob?: JobRunner;
  },
): void {
  const createTranscriptRepository =
    options.createTranscriptRepository ?? defaultTranscriptRepoFactory;
  const createSummaryRepository =
    options.createSummaryRepository ?? defaultSummaryRepoFactory;
  const createProvider = options.createProvider ?? createTranscriptionProvider;
  const runJob =
    options.runJob ??
    defaultJobRunner(options.createRepository, createTranscriptRepository, createProvider);

  router.post('/:id/transcribe', async (req, res, next) => {
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
          'Upload audio before starting transcription',
          400,
        );
      }

      if (session.status === 'transcribing') {
        res.status(202).json(
          apiSuccess(
            TranscribeAcceptedSchema.parse({
              sessionId: id,
              status: 'transcribing',
            }),
          ),
        );
        return;
      }

      // Ensure provider is configured before flipping status.
      createProvider();

      const updated = await options.createRepository(req).update(req.user.id, id, {
        status: 'transcribing',
      });
      if (!updated) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      runJob(id, req);

      res.status(202).json(
        apiSuccess(
          TranscribeAcceptedSchema.parse({
            sessionId: id,
            status: 'transcribing',
          }),
        ),
      );
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/transcript', async (req, res, next) => {
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
      if (!transcript) {
        throw new AppError('NOT_FOUND', 'Transcript not found', 404);
      }

      res.status(200).json(apiSuccess(TranscriptSchema.parse(transcript)));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/status', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const [transcript, summary] = await Promise.all([
        createTranscriptRepository(req).getBySessionId(id),
        createSummaryRepository(req).getBySessionId(id),
      ]);
      const payload = SessionStatusResponseSchema.parse({
        sessionId: id,
        status: session.status,
        hasAudio: Boolean(session.audioPath),
        hasTranscript: Boolean(transcript),
        hasSummary: Boolean(summary),
      });

      res.status(200).json(apiSuccess(payload));
    } catch (err) {
      next(err);
    }
  });
}
