import { logger } from '../../lib/logger.js';
import { AppError } from '../../middleware/error-handler.js';
import type { SummaryProvider } from '../../providers/summary/types.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { TranscriptRepository } from '../transcripts/repository.js';
import type { SummaryRepository } from '../summaries/repository.js';

export interface SummaryJobDeps {
  sessions: SessionRepository;
  transcripts: TranscriptRepository;
  summaries: SummaryRepository;
  provider: SummaryProvider;
  userId: string;
}

/**
 * Runs Claude summarization for a session that already has a transcript.
 * Intended to be invoked after status is set to `summarizing`.
 * Failures set session status to `failed` without deleting audio/transcript.
 */
export async function runSummaryJob(sessionId: string, deps: SummaryJobDeps): Promise<void> {
  try {
    const session = await deps.sessions.getById(deps.userId, sessionId);
    if (!session) {
      throw new AppError('NOT_FOUND', 'Session not found', 404);
    }

    const transcript = await deps.transcripts.getBySessionId(sessionId);
    if (!transcript?.text?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Session has no transcript to summarize', 400);
    }

    const summary = await deps.provider.summarize({
      transcriptText: transcript.text,
      sessionType: session.sessionType,
      title: session.title,
    });

    await deps.summaries.upsertForSession(sessionId, summary);
    await deps.sessions.update(deps.userId, sessionId, { status: 'completed' });

    logger.info('Summary completed', {
      sessionId,
      provider: deps.provider.name,
      keyPointCount: summary.keyPoints.length,
    });
  } catch (err) {
    logger.error('Summary job failed', {
      sessionId,
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    try {
      await deps.sessions.update(deps.userId, sessionId, { status: 'failed' });
    } catch (updateErr) {
      logger.error('Failed to mark session as failed after summary error', {
        sessionId,
        message: updateErr instanceof Error ? updateErr.message : 'Unknown error',
      });
    }
  }
}
