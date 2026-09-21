import {
  apiSuccess,
  SessionFeedbackSchema,
  SessionIdParamSchema,
  UpsertFeedbackSchema,
} from '@sessionai/shared';
import type { Request, Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  SupabaseFeedbackRepository,
  type FeedbackRepository,
} from '../services/feedback/repository.js';
import type { SessionRepoFactory } from './sessions.js';

export type FeedbackRepoFactory = (req: Request) => FeedbackRepository;

function defaultFeedbackRepoFactory(req: Request): FeedbackRepository {
  if (!req.accessToken) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return new SupabaseFeedbackRepository(createSupabaseUserClient(req.accessToken));
}

export function registerFeedbackRoutes(
  router: Router,
  options: {
    createRepository: SessionRepoFactory;
    createFeedbackRepository?: FeedbackRepoFactory;
  },
): void {
  const createFeedbackRepository =
    options.createFeedbackRepository ?? defaultFeedbackRepoFactory;

  router.get('/:id/feedback', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const feedback = await createFeedbackRepository(req).getForSession(id);
      res.status(200).json(apiSuccess(SessionFeedbackSchema.parse(feedback)));
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id/feedback', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const { target, rating } = UpsertFeedbackSchema.parse(req.body);

      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const repo = createFeedbackRepository(req);
      const feedback =
        rating == null
          ? await repo.clear(id, target)
          : await repo.upsert(id, target, rating);

      res.status(200).json(apiSuccess(SessionFeedbackSchema.parse(feedback)));
    } catch (err) {
      next(err);
    }
  });
}
