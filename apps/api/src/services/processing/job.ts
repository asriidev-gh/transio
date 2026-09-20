import { logger } from '../../lib/logger.js';
import { AppError } from '../../middleware/error-handler.js';
import type { SummaryProvider } from '../../providers/summary/types.js';
import type { TranscriptionProvider } from '../../providers/transcription/types.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { SummaryRepository } from '../summaries/repository.js';
import type { TranscriptRepository } from '../transcripts/repository.js';

export interface ProcessingPipelineDeps {
  sessions: SessionRepository;
  transcripts: TranscriptRepository;
  summaries: SummaryRepository;
  transcriptionProvider: TranscriptionProvider;
  summaryProvider: SummaryProvider;
  downloadAudio: (audioPath: string) => Promise<{ data: Buffer; mimeType: string }>;
  userId: string;
}

/**
 * End-to-end pipeline: transcribe (if needed) → summarize → completed.
 * Failures set status to `failed` without deleting audio/transcript.
 */
export async function runProcessingPipeline(
  sessionId: string,
  deps: ProcessingPipelineDeps,
): Promise<void> {
  try {
    const session = await deps.sessions.getById(deps.userId, sessionId);
    if (!session) {
      throw new AppError('NOT_FOUND', 'Session not found', 404);
    }
    if (!session.audioPath) {
      throw new AppError('VALIDATION_ERROR', 'Session has no uploaded audio', 400);
    }

    let transcript = await deps.transcripts.getBySessionId(sessionId);

    if (!transcript?.text?.trim()) {
      await deps.sessions.update(deps.userId, sessionId, { status: 'transcribing' });

      const audio = await deps.downloadAudio(session.audioPath);
      const fileName = session.audioPath.split('/').pop() || 'audio.m4a';
      const result = await deps.transcriptionProvider.transcribe({
        audio: audio.data,
        mimeType: audio.mimeType,
        fileName,
      });

      transcript = await deps.transcripts.upsertForSession(
        sessionId,
        result.text,
        result.language ?? null,
      );
      await deps.sessions.update(deps.userId, sessionId, { status: 'transcribed' });

      logger.info('Pipeline transcription completed', {
        sessionId,
        provider: deps.transcriptionProvider.name,
        textLength: result.text.length,
      });
    }

    await deps.sessions.update(deps.userId, sessionId, { status: 'summarizing' });

    const refreshed = await deps.sessions.getById(deps.userId, sessionId);
    if (!refreshed) {
      throw new AppError('NOT_FOUND', 'Session not found', 404);
    }

    const summary = await deps.summaryProvider.summarize({
      transcriptText: transcript.text,
      sessionType: refreshed.sessionType,
      title: refreshed.title,
    });

    await deps.summaries.upsertForSession(sessionId, summary);
    await deps.sessions.update(deps.userId, sessionId, { status: 'completed' });

    logger.info('Pipeline completed', {
      sessionId,
      transcriptionProvider: deps.transcriptionProvider.name,
      summaryProvider: deps.summaryProvider.name,
      keyPointCount: summary.keyPoints.length,
    });
  } catch (err) {
    logger.error('Processing pipeline failed', {
      sessionId,
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    try {
      await deps.sessions.update(deps.userId, sessionId, { status: 'failed' });
    } catch (updateErr) {
      logger.error('Failed to mark session as failed after pipeline error', {
        sessionId,
        message: updateErr instanceof Error ? updateErr.message : 'Unknown error',
      });
    }
  }
}
