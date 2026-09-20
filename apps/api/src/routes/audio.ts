import multer from 'multer';
import {
  apiSuccess,
  AudioUploadResultSchema,
  SessionIdParamSchema,
  SignedAudioUrlSchema,
} from '@sessionai/shared';
import type { Request } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import type { SessionRepository } from '../services/sessions/repository.js';
import {
  resolveUploadPath,
  SupabaseAudioStorage,
  type AudioStorage,
} from '../services/storage/audio-storage.js';
import type { SessionRepoFactory } from './sessions.js';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const type = file.mimetype.toLowerCase();
    if (
      type.startsWith('audio/') ||
      type === 'application/octet-stream' ||
      type === 'video/webm' // some browsers label recorded audio this way
    ) {
      cb(null, true);
      return;
    }
    cb(new AppError('VALIDATION_ERROR', 'Only audio files are allowed', 400));
  },
});

export type AudioStorageFactory = (req: Request) => AudioStorage;

/**
 * Storage uploads/signed URLs go through the service role after the route has
 * verified JWT + session ownership and forced a `{userId}/{sessionId}/…` path.
 * This avoids depending on storage.objects RLS being applied in every project.
 */
function defaultAudioStorageFactory(_req: Request): AudioStorage {
  return new SupabaseAudioStorage(getSupabaseServiceClient());
}

export function registerAudioRoutes(
  router: import('express').Router,
  options: {
    createRepository: SessionRepoFactory;
    createAudioStorage?: AudioStorageFactory;
    /** Optional: start end-to-end processing after a successful upload. */
    onUploaded?: (sessionId: string, req: Request) => void;
  },
): void {
  const createAudioStorage = options.createAudioStorage ?? defaultAudioStorageFactory;
  const createRepository = options.createRepository;

  router.post('/:id/audio', audioUpload.single('file'), async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const file = req.file;
      if (!file) {
        throw new AppError('VALIDATION_ERROR', 'Audio file is required', 400);
      }

      const repo = createRepository(req);
      const session = await repo.getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const audioPath = resolveUploadPath(
        req.user.id,
        id,
        file.mimetype,
        file.originalname,
      );

      const storage = createAudioStorage(req);
      await storage.upload(audioPath, file.buffer, file.mimetype || 'application/octet-stream');

      const updated = await repo.update(req.user.id, id, {
        audioPath,
        status: 'uploaded',
      });

      if (!updated) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const payload = AudioUploadResultSchema.parse({
        sessionId: id,
        audioPath,
        status: 'uploaded',
      });

      res.status(200).json(apiSuccess(payload));

      // Fire-and-forget end-to-end pipeline (Phase 8). Does not affect the upload response.
      options.onUploaded?.(id, req);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/audio-url', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const session = await createRepository(req).getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      if (!session.audioPath) {
        throw new AppError('NOT_FOUND', 'No uploaded audio for this session', 404);
      }

      // Defense in depth: path must start with the caller's user id.
      if (!session.audioPath.startsWith(`${req.user.id}/`)) {
        throw new AppError('FORBIDDEN', 'Audio path does not belong to this user', 403);
      }

      const expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS;
      const url = await createAudioStorage(req).createSignedUrl(session.audioPath, expiresIn);
      const payload = SignedAudioUrlSchema.parse({
        url,
        expiresIn,
        audioPath: session.audioPath,
      });

      res.status(200).json(apiSuccess(payload));
    } catch (err) {
      next(err);
    }
  });
}

/** Helper exported for tests that need repository typing. */
export type { SessionRepository };
