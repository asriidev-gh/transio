import {
  apiSuccess,
  CreateSessionSchema,
  SessionIdParamSchema,
  UpdateSessionSchema,
} from '@sessionai/shared';
import { Router, type Request, type RequestHandler } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { createSupabaseUserClient } from '../lib/supabase.js';
import { createSummaryProvider } from '../providers/summary/index.js';
import { createTranscriptionProvider } from '../providers/transcription/index.js';
import { runProcessingPipeline } from '../services/processing/job.js';
import {
  SupabaseSessionRepository,
  type SessionRepository,
} from '../services/sessions/repository.js';
import { SupabaseSummaryRepository } from '../services/summaries/repository.js';
import {
  createSupabaseAudioDownloader,
} from '../services/transcription/job.js';
import { SupabaseTranscriptRepository } from '../services/transcripts/repository.js';
import { registerAudioRoutes, type AudioStorageFactory } from './audio.js';
import {
  registerProcessRoutes,
  tryStartProcessingAfterUpload,
  type ProcessJobRunner,
} from './process.js';
import {
  registerSummaryRoutes,
  type SummaryJobRunner,
  type SummaryProviderFactory,
  type SummaryRepoFactory,
} from './summary.js';
import {
  registerTranscriptionRoutes,
  type JobRunner,
  type TranscriptRepoFactory,
  type TranscriptionProviderFactory,
} from './transcription.js';

export type SessionRepoFactory = (req: Request) => SessionRepository;

function defaultRepoFactory(req: Request): SessionRepository {
  if (!req.accessToken) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return new SupabaseSessionRepository(createSupabaseUserClient(req.accessToken));
}

function createDefaultProcessJobRunner(
  createRepository: SessionRepoFactory,
  createTranscriptRepository: TranscriptRepoFactory | undefined,
  createSummaryRepository: SummaryRepoFactory | undefined,
  createTranscriptionProviderFn: TranscriptionProviderFactory | undefined,
  createSummaryProviderFn: SummaryProviderFactory | undefined,
): ProcessJobRunner {
  return (sessionId, req) => {
    if (!req.user || !req.accessToken) {
      return;
    }

    const client = createSupabaseUserClient(req.accessToken);
    const transcripts =
      createTranscriptRepository?.(req) ??
      new SupabaseTranscriptRepository(client);
    const summaries =
      createSummaryRepository?.(req) ?? new SupabaseSummaryRepository(client);

    void runProcessingPipeline(sessionId, {
      userId: req.user.id,
      sessions: createRepository(req),
      transcripts,
      summaries,
      transcriptionProvider: (createTranscriptionProviderFn ?? createTranscriptionProvider)(),
      summaryProvider: (createSummaryProviderFn ?? createSummaryProvider)(),
      downloadAudio: createSupabaseAudioDownloader(client),
    });
  };
}

export function createSessionsRouter(options: {
  createRepository?: SessionRepoFactory;
  createAudioStorage?: AudioStorageFactory;
  createTranscriptRepository?: TranscriptRepoFactory;
  createTranscriptionProvider?: TranscriptionProviderFactory;
  runTranscriptionJob?: JobRunner;
  createSummaryRepository?: SummaryRepoFactory;
  createSummaryProvider?: SummaryProviderFactory;
  runSummaryJob?: SummaryJobRunner;
  runProcessJob?: ProcessJobRunner;
  authenticate?: RequestHandler;
} = {}): Router {
  const router = Router();
  const createRepository = options.createRepository ?? defaultRepoFactory;
  const authenticate = options.authenticate ?? requireAuth;

  const runProcessJob =
    options.runProcessJob ??
    createDefaultProcessJobRunner(
      createRepository,
      options.createTranscriptRepository,
      options.createSummaryRepository,
      options.createTranscriptionProvider,
      options.createSummaryProvider,
    );

  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }
      const sessions = await createRepository(req).list(req.user.id);
      res.status(200).json(apiSuccess(sessions));
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }
      const input = CreateSessionSchema.parse(req.body);
      const session = await createRepository(req).create(req.user.id, input);
      res.status(201).json(apiSuccess(session));
    } catch (err) {
      next(err);
    }
  });

  registerAudioRoutes(router, {
    createRepository,
    createAudioStorage: options.createAudioStorage,
    onUploaded: (sessionId, req) => {
      tryStartProcessingAfterUpload(sessionId, req, {
        createRepository,
        runJob: runProcessJob,
        createTranscriptionProvider: options.createTranscriptionProvider,
        createSummaryProvider: options.createSummaryProvider,
      });
    },
  });

  registerTranscriptionRoutes(router, {
    createRepository,
    createTranscriptRepository: options.createTranscriptRepository,
    createSummaryRepository: options.createSummaryRepository,
    createProvider: options.createTranscriptionProvider,
    runJob: options.runTranscriptionJob,
  });

  registerSummaryRoutes(router, {
    createRepository,
    createTranscriptRepository: options.createTranscriptRepository,
    createSummaryRepository: options.createSummaryRepository,
    createProvider: options.createSummaryProvider,
    runJob: options.runSummaryJob,
  });

  registerProcessRoutes(router, {
    createRepository,
    createTranscriptRepository: options.createTranscriptRepository,
    createSummaryRepository: options.createSummaryRepository,
    createTranscriptionProvider: options.createTranscriptionProvider,
    createSummaryProvider: options.createSummaryProvider,
    runJob: runProcessJob,
  });

  router.get('/:id', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }
      const { id } = SessionIdParamSchema.parse(req.params);
      const session = await createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }
      res.status(200).json(apiSuccess(session));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }
      const { id } = SessionIdParamSchema.parse(req.params);
      const input = UpdateSessionSchema.parse(req.body);
      const session = await createRepository(req).update(req.user.id, id, input);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }
      res.status(200).json(apiSuccess(session));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }
      const { id } = SessionIdParamSchema.parse(req.params);
      const deleted = await createRepository(req).delete(req.user.id, id);
      if (!deleted) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }
      res.status(200).json(apiSuccess({ id }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
