import cors from 'cors';
import express from 'express';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use((req, _res, next) => {
    logger.info('request', { method: req.method, path: req.path });
    next();
  });

  app.use(healthRouter);
  app.use(meRouter);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  app.use(errorHandler);

  return app;
}
