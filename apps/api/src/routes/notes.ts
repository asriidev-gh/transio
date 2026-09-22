import {
  apiSuccess,
  FinalizeNotesRequestSchema,
  isNotesOnlyCaptureMode,
  LiveNotesChunkRequestSchema,
  LiveNotesChunkResultSchema,
  SessionIdParamSchema,
  SummaryRecordSchema,
} from '@sessionai/shared';
import type { Request, Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { createSupabaseUserClient } from '../lib/supabase.js';
import { createSummaryProvider } from '../providers/summary/index.js';
import type { SummaryProvider } from '../providers/summary/types.js';
import {
  SupabaseSummaryRepository,
  type SummaryRepository,
} from '../services/summaries/repository.js';
import type { SessionRepoFactory } from './sessions.js';
import type { SummaryProviderFactory, SummaryRepoFactory } from './summary.js';

function defaultSummaryRepoFactory(req: Request): SummaryRepository {
  if (!req.accessToken) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return new SupabaseSummaryRepository(createSupabaseUserClient(req.accessToken));
}

export function registerNotesRoutes(
  router: Router,
  options: {
    createRepository: SessionRepoFactory;
    createSummaryRepository?: SummaryRepoFactory;
    createSummaryProvider?: SummaryProviderFactory;
  },
): void {
  const createSummaryRepository =
    options.createSummaryRepository ?? defaultSummaryRepoFactory;
  const createProvider = options.createSummaryProvider ?? createSummaryProvider;

  /** Merge a live speech chunk into structured notes (no transcript persistence). */
  router.post('/:id/notes-live', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const body = LiveNotesChunkRequestSchema.parse(req.body);
      const session = await options.createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const provider: SummaryProvider = createProvider();
      const notes = await provider.mergeLiveNotes({
        text: body.text,
        previousNotes: body.previousNotes,
        sessionType: session.sessionType,
        title: session.title,
      });

      const parsed = LiveNotesChunkResultSchema.parse(notes);
      // Persist incrementally so notes survive if the client leaves before finalize.
      try {
        await createSummaryRepository(req).upsertForSession(id, parsed);
      } catch {
        // Non-fatal — client still receives notes and can finalize later.
      }

      res.status(200).json(apiSuccess(parsed));
    } catch (err) {
      next(err);
    }
  });

  /** Persist final notes and mark session completed (notes-only modes). */
  router.post('/:id/notes/finalize', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const notes = FinalizeNotesRequestSchema.parse(req.body);
      const sessions = options.createRepository(req);
      const session = await sessions.getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      if (!isNotesOnlyCaptureMode(session.captureMode)) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Notes finalize is only for Auto Notes or Live Note Taker sessions.',
          400,
        );
      }

      const record = await createSummaryRepository(req).upsertForSession(id, notes);
      const updated = await sessions.update(req.user.id, id, {
        status: 'completed',
      });
      if (!updated) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      res.status(200).json(apiSuccess(SummaryRecordSchema.parse(record)));
    } catch (err) {
      next(err);
    }
  });
}
