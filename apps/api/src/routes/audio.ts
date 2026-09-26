import multer from 'multer';
import {
  apiSuccess,
  AudioUploadResultSchema,
  ImportMediaUrlSchema,
  SessionIdParamSchema,
  SignedAudioUrlSchema,
} from '@sessionai/shared';
import type { Request } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { maxUploadBytes } from '../lib/limits.js';
import { uploadGate } from '../middleware/upload-gate.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import {
  isAllowedUploadMedia,
  prepareMediaForTranscription,
  type MediaBytes,
} from '../services/media/extract-audio.js';
import { fetchRemoteMedia } from '../services/media/fetch-media.js';
import type { SessionRepository } from '../services/sessions/repository.js';
import {
  resolveUploadPath,
  SupabaseAudioStorage,
  type AudioStorage,
} from '../services/storage/audio-storage.js';
import type { SessionRepoFactory } from './sessions.js';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const MAX_AUDIO_BYTES = maxUploadBytes();

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUploadMedia(file.mimetype, file.originalname || 'upload')) {
      cb(null, true);
      return;
    }
    cb(new AppError('VALIDATION_ERROR', 'Only audio or video files are allowed', 400));
  },
});

export type AudioStorageFactory = (req: Request) => AudioStorage;
export type MediaPreparer = (input: MediaBytes) => Promise<MediaBytes>;
export type RemoteMediaFetcher = typeof fetchRemoteMedia;

/**
 * Storage uploads/signed URLs go through the service role after the route has
 * verified JWT + session ownership and forced a `{userId}/{sessionId}/…` path.
 * This avoids depending on storage.objects RLS being applied in every project.
 */
function defaultAudioStorageFactory(_req: Request): AudioStorage {
  return new SupabaseAudioStorage(getSupabaseServiceClient());
}

async function storePreparedMedia(options: {
  userId: string;
  sessionId: string;
  media: MediaBytes;
  repo: SessionRepository;
  storage: AudioStorage;
}): Promise<{ audioPath: string; status: string }> {
  const audioPath = resolveUploadPath(
    options.userId,
    options.sessionId,
    options.media.mimeType,
    options.media.fileName,
  );
  await options.storage.upload(
    audioPath,
    options.media.data,
    options.media.mimeType || 'application/octet-stream',
  );

  const existing = await options.repo.getById(options.userId, options.sessionId);
  // Live Note Taker finalizes notes before upload — never drop `completed` to
  // `uploaded` (that used to re-trigger Whisper and hide saved bullets).
  const isLiveNotes = existing?.captureMode === 'live_notes';
  const keepCompleted = isLiveNotes && existing.status === 'completed';
  const nextStatus = keepCompleted ? 'completed' : isLiveNotes ? existing.status : 'uploaded';

  const updated = await options.repo.update(options.userId, options.sessionId, {
    audioPath,
    status: nextStatus === 'recording' ? 'uploaded' : nextStatus,
  });
  if (!updated) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }
  return { audioPath, status: updated.status };
}

export function registerAudioRoutes(
  router: import('express').Router,
  options: {
    createRepository: SessionRepoFactory;
    createAudioStorage?: AudioStorageFactory;
    /** Optional: start end-to-end processing after a successful upload. */
    onUploaded?: (sessionId: string, req: Request) => void;
    prepareMedia?: MediaPreparer;
    fetchRemoteMedia?: RemoteMediaFetcher;
  },
): void {
  const createAudioStorage = options.createAudioStorage ?? defaultAudioStorageFactory;
  const createRepository = options.createRepository;
  const prepareMedia = options.prepareMedia ?? prepareMediaForTranscription;
  const downloadRemote = options.fetchRemoteMedia ?? fetchRemoteMedia;

  router.post('/:id/audio', uploadGate(), audioUpload.single('file'), async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const file = req.file;
      if (!file) {
        throw new AppError('VALIDATION_ERROR', 'Audio or video file is required', 400);
      }

      const repo = createRepository(req);
      const session = await repo.getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const prepared = await prepareMedia({
        data: file.buffer,
        mimeType: file.mimetype || 'application/octet-stream',
        fileName: file.originalname || 'upload',
      });

      const { audioPath, status: storedStatus } = await storePreparedMedia({
        userId: req.user.id,
        sessionId: id,
        media: prepared,
        repo,
        storage: createAudioStorage(req),
      });

      const payload = AudioUploadResultSchema.parse({
        sessionId: id,
        audioPath,
        status: storedStatus === 'completed' ? 'completed' : 'uploaded',
      });

      res.status(200).json(apiSuccess(payload));
      options.onUploaded?.(id, req);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/import-url', uploadGate(), async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const { url } = ImportMediaUrlSchema.parse(req.body);

      const repo = createRepository(req);
      const session = await repo.getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      const remote = await downloadRemote(url);
      if (!isAllowedUploadMedia(remote.mimeType, remote.fileName)) {
        throw new AppError(
          'VALIDATION_ERROR',
          'That URL is not an audio or video file. Paste a direct .mp4 / .webm / .mp3 link, or upload a file.',
          400,
        );
      }

      const prepared = await prepareMedia({
        data: remote.data,
        mimeType: remote.mimeType,
        fileName: remote.fileName,
      });

      const { audioPath, status: storedStatus } = await storePreparedMedia({
        userId: req.user.id,
        sessionId: id,
        media: prepared,
        repo,
        storage: createAudioStorage(req),
      });

      const payload = AudioUploadResultSchema.parse({
        sessionId: id,
        audioPath,
        status: storedStatus === 'completed' ? 'completed' : 'uploaded',
      });

      res.status(200).json(apiSuccess(payload));
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

  /**
   * Drops the cloud copy once transcription is done, for sessions the user asked
   * to keep on their phone. audio_storage stays 'device' so the app can tell this
   * apart from a session that never had audio.
   */
  router.delete('/:id/audio', async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { id } = SessionIdParamSchema.parse(req.params);
      const repository = createRepository(req);
      const session = await repository.getById(req.user.id, id);
      if (!session) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      if (session.audioPath) {
        // Defense in depth: path must start with the caller's user id.
        if (!session.audioPath.startsWith(`${req.user.id}/`)) {
          throw new AppError('FORBIDDEN', 'Audio path does not belong to this user', 403);
        }
        await createAudioStorage(req).remove(session.audioPath);
      }

      // Idempotent: a repeat call on an already-cleared session still succeeds.
      const updated = await repository.update(req.user.id, id, {
        audioPath: null,
        audioStorage: 'device',
      });
      if (!updated) {
        throw new AppError('NOT_FOUND', 'Session not found', 404);
      }

      res.status(200).json(apiSuccess(updated));
    } catch (err) {
      next(err);
    }
  });
}

/** Helper exported for tests that need repository typing. */
export type { SessionRepository };
