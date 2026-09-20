import { apiSuccess, type HealthResponse } from '@sessionai/shared';
import { Router } from 'express';
import { getEnv, isSupabaseConfigured } from '../lib/env.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const env = getEnv();
  const payload: HealthResponse = {
    status: 'ok',
    service: 'sessionai-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured(env),
  };

  res.status(200).json(apiSuccess(payload));
});
