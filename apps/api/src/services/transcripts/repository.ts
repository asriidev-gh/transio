import { TranscriptSchema, type Transcript } from '@sessionai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/error-handler.js';

export interface TranscriptRow {
  id: string;
  session_id: string;
  text: string;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export function mapTranscriptRow(row: TranscriptRow): Transcript {
  return TranscriptSchema.parse({
    id: row.id,
    sessionId: row.session_id,
    text: row.text,
    language: row.language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export interface TranscriptRepository {
  getBySessionId(sessionId: string): Promise<Transcript | null>;
  upsertForSession(
    sessionId: string,
    text: string,
    language: string | null,
  ): Promise<Transcript>;
}

export class SupabaseTranscriptRepository implements TranscriptRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getBySessionId(sessionId: string): Promise<Transcript | null> {
    const { data, error } = await this.client
      .from('transcripts')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      throw new AppError(
        'DATABASE_ERROR',
        `Could not load transcript (${error.message}). Apply migration 202609200003_create_transcripts.sql in Supabase.`,
        500,
      );
    }
    if (!data) return null;
    return mapTranscriptRow(data as TranscriptRow);
  }

  async upsertForSession(
    sessionId: string,
    text: string,
    language: string | null,
  ): Promise<Transcript> {
    const { data, error } = await this.client
      .from('transcripts')
      .upsert(
        {
          session_id: sessionId,
          text,
          language,
        },
        { onConflict: 'session_id' },
      )
      .select('*')
      .single();

    if (error) {
      throw new AppError('DATABASE_ERROR', 'Could not save transcript', 500);
    }

    return mapTranscriptRow(data as TranscriptRow);
  }
}

export class InMemoryTranscriptRepository implements TranscriptRepository {
  private readonly bySession = new Map<string, Transcript>();

  async getBySessionId(sessionId: string): Promise<Transcript | null> {
    return this.bySession.get(sessionId) ?? null;
  }

  async upsertForSession(
    sessionId: string,
    text: string,
    language: string | null,
  ): Promise<Transcript> {
    const existing = this.bySession.get(sessionId);
    const now = new Date().toISOString();
    const row: Transcript = {
      id: existing?.id ?? crypto.randomUUID(),
      sessionId,
      text,
      language,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.bySession.set(sessionId, row);
    return row;
  }
}
