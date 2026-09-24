import cors from 'cors';
import express from 'express';
import type { RequestHandler } from 'express';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import type { AudioStorageFactory, MediaPreparer, RemoteMediaFetcher } from './routes/audio.js';
import {
  createSessionsRouter,
  type SessionRepoFactory,
} from './routes/sessions.js';
import { createFoldersRouter, type FolderRepoFactory } from './routes/folders.js';
import type {
  SummaryJobRunner,
  SummaryProviderFactory,
  SummaryRepoFactory,
} from './routes/summary.js';
import type { AskProviderFactory } from './routes/ask.js';
import type { FeedbackRepoFactory } from './routes/feedback.js';
import type { ProcessJobRunner } from './routes/process.js';
import type { TranslateProviderFactory } from './routes/translate.js';
import { createVoiceTranslateRouter } from './routes/voice-translate.js';
import type {
  JobRunner,
  TranscriptRepoFactory,
  TranscriptionProviderFactory,
} from './routes/transcription.js';

export interface AppDeps {
  createSessionRepository?: SessionRepoFactory;
  createFolderRepository?: FolderRepoFactory;
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
}

function buildCorsOrigin() {
  const env = getEnv();
  const allowed = env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    if (env.NODE_ENV === 'production') {
      logger.warn('CORS_ORIGINS is empty in production — browser cross-origin calls are denied');
      return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        // Non-browser / same-origin mobile clients often send no Origin.
        if (!origin) return cb(null, true);
        return cb(null, false);
      };
    }
    // Local Expo web / simulators.
    return true;
  }

  return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(null, false);
  };
}

export function createApp(deps: AppDeps = {}) {
  const app = express();

  app.use(
    cors({
      origin: buildCorsOrigin(),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use((req, _res, next) => {
    logger.info('request', { method: req.method, path: req.path });
    next();
  });

  app.use(healthRouter);
  app.use(meRouter);
  app.use(
    '/folders',
    createFoldersRouter({
      createRepository: deps.createFolderRepository,
      authenticate: deps.authenticate,
    }),
  );
  app.use(
    '/sessions',
    createSessionsRouter({
      createRepository: deps.createSessionRepository,
      createAudioStorage: deps.createAudioStorage,
      prepareMedia: deps.prepareMedia,
      fetchRemoteMedia: deps.fetchRemoteMedia,
      createTranscriptRepository: deps.createTranscriptRepository,
      createTranscriptionProvider: deps.createTranscriptionProvider,
      runTranscriptionJob: deps.runTranscriptionJob,
      createSummaryRepository: deps.createSummaryRepository,
      createSummaryProvider: deps.createSummaryProvider,
      createAskProvider: deps.createAskProvider,
      createTranslateProvider: deps.createTranslateProvider,
      createFeedbackRepository: deps.createFeedbackRepository,
      runSummaryJob: deps.runSummaryJob,
      runProcessJob: deps.runProcessJob,
      authenticate: deps.authenticate,
    }),
  );
  app.use(
    '/translate',
    createVoiceTranslateRouter({
      createTranscriptionProvider: deps.createTranscriptionProvider,
      createTranslateProvider: deps.createTranslateProvider,
      authenticate: deps.authenticate,
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  app.use(errorHandler);

  return app;
}
