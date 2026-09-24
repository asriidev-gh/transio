import { apiSuccess } from '@sessionai/shared';
import { Router } from 'express';
import { maxUploadBytes } from '../lib/limits.js';
import { maxAudioMinutes } from '../services/media/extract-audio.js';

export const limitsRouter = Router();

/** Public, non-sensitive: lets the app warn before uploading a file the API would reject. */
limitsRouter.get('/limits', (_req, res) => {
  res.status(200).json(
    apiSuccess({
      maxUploadMb: Math.round(maxUploadBytes() / (1024 * 1024)),
      maxAudioMinutes: maxAudioMinutes(),
    }),
  );
});
