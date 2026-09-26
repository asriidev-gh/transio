import {
  apiSuccess,
  CreateSessionSchema,
  SessionIdParamSchema,
  UpdateSessionSchema,
} from '@sessionai/shared';
import { Router, type Request, type RequestHandler } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import {
  createSupabaseUserClient,
  getJobSupabaseClient,
  getSupabaseServiceClient,
} from '../lib/supabase.js';
import { enqueueJob } from '../lib/job-queue.js';
import { userRateLimit } from '../middleware/rate-limit.js';
import { chargeQuota } from '../services/quota/index.js';
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
  createSupabaseAudioRemover,
} from '../services/transcription/job.js';
import { SupabaseTranscriptRepository } from '../services/transcripts/repository.js';
import { registerAudioRoutes, type AudioStorageFactory, type MediaPreparer, type RemoteMediaFetcher } from './audio.js';
import {
  registerAskRoutes,
  type AskProviderFactory,
} from './ask.js';
import {
  registerFeedbackRoutes,
  type FeedbackRepoFactory,
} from './feedback.js';
import {
  registerTranslateRoutes,
  type TranslateProviderFactory,
} from './translate.js';
import {
  registerProcessRoutes,
  tryStartProcessingAfterUpload,
  type ProcessJobRunner,
} from './process.js';
import { registerNotesRoutes } from './notes.js';
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
  createTranscriptionProviderFn: TranscriptionProviderFactory | undefined,
  createSummaryProviderFn: SummaryProviderFactory | undefined,
): ProcessJobRunner {
  return (sessionId, req) => {
    if (!req.user || !req.accessToken) {
      return;
    }

    const userId = req.user.id;
    const jobClient = getJobSupabaseClient(req.accessToken);
    const storageClient = getSupabaseServiceClient();
    const sessions = new SupabaseSessionRepository(jobClient);
    const transcripts = new SupabaseTranscriptRepository(jobClient);
    const summaries = new SupabaseSummaryRepository(jobClient);
    const transcriptionProvider = (createTranscriptionProviderFn ?? createTranscriptionProvider)();
    const summaryProvider = (createSummaryProviderFn ?? createSummaryProvider)();

    enqueueJob('process', () =>
      runProcessingPipeline(sessionId, {
        userId,
        sessions,
        transcripts,
        summaries,
        transcriptionProvider,
        summaryProvider,
        downloadAudio: createSupabaseAudioDownloader(storageClient),
        removeAudio: createSupabaseAudioRemover(storageClient),
      }),
    );
  };
}

export function createSessionsRouter(options: {
  createRepository?: SessionRepoFactory;
  createAudioStorage?: AudioStorageFactory;
  prepareMedia?: MediaPreparer;
  fetchRemoteMedia?: RemoteMediaFetcher;
  createTranscriptRepository?: TranscriptRepoFactory;
  createTranscriptionProvider?: TranscriptionProviderFactory;
  runTranscriptionJob?: JobRunner;
  createSummaryRepository?: SummaryRepoFactory;
  createSummaryProvider?: SummaryProviderFactory;
  createAskProvider?: AskProviderFactory;
  createTranslateProvider?: TranslateProviderFactory;
  createFeedbackRepository?: FeedbackRepoFactory;
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
      options.createTranscriptionProvider,
      options.createSummaryProvider,
    );

  router.use(authenticate);
  router.use(userRateLimit());

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
      const charge = await chargeQuota(req, 'session');
      try {
        const session = await createRepository(req).create(req.user.id, input);
        res.status(201).json(apiSuccess(session));
      } catch (err) {
        await charge.refund();
        throw err;
      }
    } catch (err) {
      next(err);
    }
  });

  registerAudioRoutes(router, {
    createRepository,
    createAudioStorage: options.createAudioStorage,
    prepareMedia: options.prepareMedia,
    fetchRemoteMedia: options.fetchRemoteMedia,
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

  registerNotesRoutes(router, {
    createRepository,
    createSummaryRepository: options.createSummaryRepository,
    createSummaryProvider: options.createSummaryProvider,
  });

  registerProcessRoutes(router, {
    createRepository,
    createTranscriptRepository: options.createTranscriptRepository,
    createSummaryRepository: options.createSummaryRepository,
    createTranscriptionProvider: options.createTranscriptionProvider,
    createSummaryProvider: options.createSummaryProvider,
    runJob: runProcessJob,
  });

  registerAskRoutes(router, {
    createRepository,
    createTranscriptRepository: options.createTranscriptRepository,
    createSummaryRepository: options.createSummaryRepository,
    createAskProvider: options.createAskProvider,
  });

  registerTranslateRoutes(router, {
    createRepository,
    createTranscriptRepository: options.createTranscriptRepository,
    createSummaryRepository: options.createSummaryRepository,
    createTranslateProvider: options.createTranslateProvider,
  });

  registerFeedbackRoutes(router, {
    createRepository,
    createFeedbackRepository: options.createFeedbackRepository,
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
