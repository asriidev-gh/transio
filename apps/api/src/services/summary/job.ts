import { isNotesOnlyCaptureMode, type SessionSummary, type SummaryRecord } from '@sessionai/shared';
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

function notesToSourceText(notes: SessionSummary | SummaryRecord): string {
  const lines: string[] = [];
  if (notes.overview?.trim()) lines.push(notes.overview.trim(), '');
  if (notes.keyPoints.length) {
    lines.push('Key points:');
    for (const point of notes.keyPoints) lines.push(`- ${point}`);
    lines.push('');
  }
  for (const topic of notes.topics) {
    lines.push(`${topic.title}: ${topic.summary}`);
  }
  if (notes.questionsDiscussed.length) {
    lines.push('', 'Questions:');
    for (const q of notes.questionsDiscussed) lines.push(`- ${q}`);
  }
  if (notes.actionItems.length) {
    lines.push('', 'Actions:');
    for (const item of notes.actionItems) {
      lines.push(`- ${item.task}${item.details ? `: ${item.details}` : ''}`);
    }
  }
  if (notes.importantInsights.length) {
    lines.push('', 'Insights:');
    for (const insight of notes.importantInsights) lines.push(`- ${insight}`);
  }
  return lines.join('\n').trim();
}

/**
 * Runs Claude summarization into an opt-in `ai_summary` row.
 * Prefers transcript text; for notes-only sessions falls back to capture notes.
 */
export async function runSummaryJob(sessionId: string, deps: SummaryJobDeps): Promise<void> {
  try {
    const session = await deps.sessions.getById(deps.userId, sessionId);
    if (!session) {
      throw new AppError('NOT_FOUND', 'Session not found', 404);
    }

    const transcript = await deps.transcripts.getBySessionId(sessionId);
    const notes = await deps.summaries.getBySessionId(sessionId, 'notes');
    const transcriptText = transcript?.text?.trim() ?? '';
    const notesText = notes ? notesToSourceText(notes) : '';
    const sourceText = transcriptText || notesText;

    if (!sourceText) {
      throw new AppError(
        'VALIDATION_ERROR',
        isNotesOnlyCaptureMode(session.captureMode)
          ? 'Session has no notes to summarize'
          : 'Session has no transcript to summarize',
        400,
      );
    }

    const summary = await deps.provider.summarize({
      transcriptText: sourceText,
      sessionType: session.sessionType,
      title: session.title,
    });

    await deps.summaries.upsertForSession(sessionId, summary, 'ai_summary');
    await deps.sessions.update(deps.userId, sessionId, { status: 'completed' });

    logger.info('Summary completed', {
      sessionId,
      provider: deps.provider.name,
      keyPointCount: summary.keyPoints.length,
      source: transcriptText ? 'transcript' : 'notes',
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
