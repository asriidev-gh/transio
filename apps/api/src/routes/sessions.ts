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
import {
  SupabaseSessionRepository,
  type SessionRepository,
} from '../services/sessions/repository.js';
import { registerAudioRoutes, type AudioStorageFactory } from './audio.js';
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

export function createSessionsRouter(options: {
  createRepository?: SessionRepoFactory;
  createAudioStorage?: AudioStorageFactory;
  createTranscriptRepository?: TranscriptRepoFactory;
  createTranscriptionProvider?: TranscriptionProviderFactory;
  runTranscriptionJob?: JobRunner;
  createSummaryRepository?: SummaryRepoFactory;
  createSummaryProvider?: SummaryProviderFactory;
  runSummaryJob?: SummaryJobRunner;
  authenticate?: RequestHandler;
} = {}): Router {
  const router = Router();
  const createRepository = options.createRepository ?? defaultRepoFactory;
  const authenticate = options.authenticate ?? requireAuth;

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
