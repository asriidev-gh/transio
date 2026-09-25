import { apiSuccess, AuthUserSchema } from '@sessionai/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { deleteAccount as deleteAccountFromSupabase } from '../services/account/delete-account.js';

const DeleteAccountBodySchema = z.object({
  /** Typed confirmation so a stray request can never delete an account. */
  confirm: z.literal('DELETE'),
});

export type AccountDeleter = (userId: string) => Promise<void>;

/** `GET /me` returns the signed-in user. `DELETE /me` permanently deletes the account. */
export function createMeRouter(
  options: { authenticate?: RequestHandler; deleteAccount?: AccountDeleter } = {},
) {
  const router = Router();
  const authenticate = options.authenticate ?? requireAuth;
  const deleteAccount: AccountDeleter =
    options.deleteAccount ?? ((userId) => deleteAccountFromSupabase(getSupabaseServiceClient(), userId));

  router.get('/me', authenticate, (req, res, next) => {
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

  router.delete('/me', authenticate, async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const parsed = DeleteAccountBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Send { "confirm": "DELETE" } to permanently delete this account',
          400,
        );
      }

      await deleteAccount(req.user.id);
      res.status(200).json(apiSuccess({ deleted: true }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
