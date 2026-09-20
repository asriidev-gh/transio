import { apiSuccess, AuthUserSchema } from '@sessionai/shared';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

export const meRouter = Router();

meRouter.get('/me', requireAuth, (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const user = AuthUserSchema.parse(req.user);
    res.status(200).json(apiSuccess(user));
  } catch (err) {
    next(err);
  }
});
