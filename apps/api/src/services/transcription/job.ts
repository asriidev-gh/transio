import { SESSION_AUDIO_BUCKET } from '@sessionai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../middleware/error-handler.js';
import { labelSegmentsBestEffort } from '../../providers/speakers/index.js';
import type { TranscriptionProvider } from '../../providers/transcription/types.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { TranscriptRepository } from '../transcripts/repository.js';

export interface TranscriptionJobDeps {
  sessions: SessionRepository;
  transcripts: TranscriptRepository;
  provider: TranscriptionProvider;
  /** Downloads private audio for the given storage path. */
  downloadAudio: (audioPath: string) => Promise<{ data: Buffer; mimeType: string }>;
  userId: string;
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  return 'audio/mp4';
}

export function createSupabaseAudioDownloader(client: SupabaseClient) {
  return async (audioPath: string): Promise<{ data: Buffer; mimeType: string }> => {
    const { data, error } = await client.storage.from(SESSION_AUDIO_BUCKET).download(audioPath);
    if (error || !data) {
      throw new AppError('STORAGE_ERROR', 'Could not download session audio for transcription', 500);
    }
    const arrayBuffer = await data.arrayBuffer();
    return {
      data: Buffer.from(arrayBuffer),
      mimeType: mimeFromPath(audioPath),
    };
  };
}

/**
 * Runs transcription for a session. Intended to be invoked after status is set to `transcribing`.
 * Failures set session status to `failed` without deleting audio.
 */
export async function runTranscriptionJob(
  sessionId: string,
  deps: TranscriptionJobDeps,
): Promise<void> {
  try {
    const session = await deps.sessions.getById(deps.userId, sessionId);
    if (!session) {
      throw new AppError('NOT_FOUND', 'Session not found', 404);
    }
    if (!session.audioPath) {
      throw new AppError('VALIDATION_ERROR', 'Session has no uploaded audio', 400);
    }

    const audio = await deps.downloadAudio(session.audioPath);
    const fileName = session.audioPath.split('/').pop() || 'audio.m4a';

    const result = await deps.provider.transcribe({
      audio: audio.data,
      mimeType: audio.mimeType,
      fileName,
    });

    const segments = result.diarized
          ? (result.segments ?? [])
          : await labelSegmentsBestEffort({
      title: session.title,
      sessionType: session.sessionType,
      segments: result.segments ?? [],
    });

    await deps.transcripts.upsertForSession(
      sessionId,
      result.text,
      result.language ?? null,
      segments,
    );
    await deps.sessions.update(deps.userId, sessionId, { status: 'transcribed' });

    logger.info('Transcription completed', {
      sessionId,
      provider: deps.provider.name,
      textLength: result.text.length,
      segmentCount: segments.length,
    });
  } catch (err) {
    logger.error('Transcription job failed', {
      sessionId,
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    try {
      await deps.sessions.update(deps.userId, sessionId, { status: 'failed' });
    } catch (updateErr) {
      logger.error('Failed to mark session as failed after transcription error', {
        sessionId,
        message: updateErr instanceof Error ? updateErr.message : 'Unknown error',
      });
    }
  }
}
