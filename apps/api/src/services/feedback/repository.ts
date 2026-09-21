import {
  SessionFeedbackSchema,
  type FeedbackRating,
  type FeedbackTarget,
  type SessionFeedback,
} from '@sessionai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/error-handler.js';

interface FeedbackRow {
  target: string;
  rating: string;
}

function mapRows(rows: FeedbackRow[]): SessionFeedback {
  let summary: FeedbackRating | null = null;
  let transcript: FeedbackRating | null = null;
  for (const row of rows) {
    if (row.target === 'summary' && (row.rating === 'up' || row.rating === 'down')) {
      summary = row.rating;
    }
    if (row.target === 'transcript' && (row.rating === 'up' || row.rating === 'down')) {
      transcript = row.rating;
    }
  }
  return SessionFeedbackSchema.parse({ summary, transcript });
}

export interface FeedbackRepository {
  getForSession(sessionId: string): Promise<SessionFeedback>;
  upsert(
    sessionId: string,
    target: FeedbackTarget,
    rating: FeedbackRating,
  ): Promise<SessionFeedback>;
  clear(sessionId: string, target: FeedbackTarget): Promise<SessionFeedback>;
}

export class SupabaseFeedbackRepository implements FeedbackRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getForSession(sessionId: string): Promise<SessionFeedback> {
    const { data, error } = await this.client
      .from('session_content_feedback')
      .select('target, rating')
      .eq('session_id', sessionId);

    if (error) {
      throw new AppError(
        'DATABASE_ERROR',
        `Could not load feedback (${error.message}). Apply migration 202609200007_session_content_feedback.sql in Supabase.`,
        500,
      );
    }

    return mapRows((data ?? []) as FeedbackRow[]);
  }

  async upsert(
    sessionId: string,
    target: FeedbackTarget,
    rating: FeedbackRating,
  ): Promise<SessionFeedback> {
    const { error } = await this.client.from('session_content_feedback').upsert(
      {
        session_id: sessionId,
        target,
        rating,
      },
      { onConflict: 'session_id,target' },
    );

    if (error) {
      throw new AppError(
        'DATABASE_ERROR',
        `Could not save feedback (${error.message}). Apply migration 202609200007_session_content_feedback.sql in Supabase.`,
        500,
      );
    }

    return this.getForSession(sessionId);
  }

  async clear(sessionId: string, target: FeedbackTarget): Promise<SessionFeedback> {
    const { error } = await this.client
      .from('session_content_feedback')
      .delete()
      .eq('session_id', sessionId)
      .eq('target', target);

    if (error) {
      throw new AppError(
        'DATABASE_ERROR',
        `Could not clear feedback (${error.message}). Apply migration 202609200007_session_content_feedback.sql in Supabase.`,
        500,
      );
    }

    return this.getForSession(sessionId);
  }
}

export class InMemoryFeedbackRepository implements FeedbackRepository {
  private readonly bySession = new Map<string, Map<FeedbackTarget, FeedbackRating>>();

  async getForSession(sessionId: string): Promise<SessionFeedback> {
    const map = this.bySession.get(sessionId);
    return SessionFeedbackSchema.parse({
      summary: map?.get('summary') ?? null,
      transcript: map?.get('transcript') ?? null,
    });
  }

  async upsert(
    sessionId: string,
    target: FeedbackTarget,
    rating: FeedbackRating,
  ): Promise<SessionFeedback> {
    const map = this.bySession.get(sessionId) ?? new Map();
    map.set(target, rating);
    this.bySession.set(sessionId, map);
    return this.getForSession(sessionId);
  }

  async clear(sessionId: string, target: FeedbackTarget): Promise<SessionFeedback> {
    const map = this.bySession.get(sessionId);
    map?.delete(target);
    return this.getForSession(sessionId);
  }
}
