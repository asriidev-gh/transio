import { isNotesOnlyCaptureMode } from '@sessionai/shared';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../middleware/error-handler.js';
import { labelSegmentsBestEffort } from '../../providers/speakers/index.js';
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
 * Notes-only capture modes transcribe ephemerally and never persist a transcript.
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

    const notesOnly = isNotesOnlyCaptureMode(session.captureMode);
    let transcriptText = '';

    if (!notesOnly) {
      const existing = await deps.transcripts.getBySessionId(sessionId);
      if (existing?.text?.trim()) {
        transcriptText = existing.text;
      }
    }

    if (!transcriptText.trim()) {
      await deps.sessions.update(deps.userId, sessionId, { status: 'transcribing' });

      const audio = await deps.downloadAudio(session.audioPath);
      const fileName = session.audioPath.split('/').pop() || 'audio.m4a';
      const result = await deps.transcriptionProvider.transcribe({
        audio: audio.data,
        mimeType: audio.mimeType,
        fileName,
      });

      transcriptText = result.text;

      if (!notesOnly) {
        const segments = await labelSegmentsBestEffort({
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
      }

      logger.info('Pipeline transcription completed', {
        sessionId,
        provider: deps.transcriptionProvider.name,
        textLength: result.text.length,
        notesOnly,
        persisted: !notesOnly,
      });
    }

    if (!transcriptText.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Transcription produced empty text', 400);
    }

    await deps.sessions.update(deps.userId, sessionId, { status: 'summarizing' });

    const refreshed = await deps.sessions.getById(deps.userId, sessionId);
    if (!refreshed) {
      throw new AppError('NOT_FOUND', 'Session not found', 404);
    }

    const summary = await deps.summaryProvider.summarize({
      transcriptText,
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
      notesOnly,
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
