import { apiSuccess } from '@sessionai/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { getEnv } from '../lib/env.js';
import { hashDeviceId, parseDeviceId } from '../services/quota/device.js';
import { getQuotaService, quotaContextFromRequest } from '../services/quota/index.js';
import type { QuotaService } from '../services/quota/service.js';

const ClaimBodySchema = z.object({ deviceId: z.string().optional() });

/**
 * Device endpoints. The app calls `POST /device/claim` right after guest sign-in so the server
 * knows which guest account owns the device.
 */
export function createDeviceRouter(
  options: { authenticate?: RequestHandler; quota?: () => QuotaService } = {},
) {
  const router = Router();
  const authenticate = options.authenticate ?? requireAuth;
  const quota = options.quota ?? getQuotaService;

  router.use(authenticate);

  router.post('/claim', async (req, res, next) => {
    try {
      const body = ClaimBodySchema.parse(req.body ?? {});
      const deviceId = parseDeviceId(req.headers['x-device-id']) ?? parseDeviceId(body.deviceId);
      if (!deviceId) {
        throw new AppError('VALIDATION_ERROR', 'A valid device id is required', 400);
      }

      const ctx = {
        ...quotaContextFromRequest(req),
        deviceHash: hashDeviceId(deviceId, getEnv().DEVICE_HASH_SECRET),
      };
      const result = await quota().claimDevice(ctx);
      res.status(200).json(apiSuccess(result));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
