import cors from 'cors';
import express from 'express';
import type { RequestHandler } from 'express';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import type { AudioStorageFactory } from './routes/audio.js';
import {
  createSessionsRouter,
  type SessionRepoFactory,
} from './routes/sessions.js';
import type {
  SummaryJobRunner,
  SummaryProviderFactory,
  SummaryRepoFactory,
} from './routes/summary.js';
import type {
  JobRunner,
  TranscriptRepoFactory,
  TranscriptionProviderFactory,
} from './routes/transcription.js';

export interface AppDeps {
  createSessionRepository?: SessionRepoFactory;
  createAudioStorage?: AudioStorageFactory;
  createTranscriptRepository?: TranscriptRepoFactory;
  createTranscriptionProvider?: TranscriptionProviderFactory;
  runTranscriptionJob?: JobRunner;
  createSummaryRepository?: SummaryRepoFactory;
  createSummaryProvider?: SummaryProviderFactory;
  runSummaryJob?: SummaryJobRunner;
  authenticate?: RequestHandler;
}

export function createApp(deps: AppDeps = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use((req, _res, next) => {
    logger.info('request', { method: req.method, path: req.path });
    next();
  });

  app.use(healthRouter);
  app.use(meRouter);
  app.use(
    '/sessions',
    createSessionsRouter({
      createRepository: deps.createSessionRepository,
      createAudioStorage: deps.createAudioStorage,
      createTranscriptRepository: deps.createTranscriptRepository,
      createTranscriptionProvider: deps.createTranscriptionProvider,
      runTranscriptionJob: deps.runTranscriptionJob,
      createSummaryRepository: deps.createSummaryRepository,
      createSummaryProvider: deps.createSummaryProvider,
      runSummaryJob: deps.runSummaryJob,
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
