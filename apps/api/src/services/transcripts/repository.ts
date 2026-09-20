import {
  TranscriptSchema,
  type Transcript,
  type TranscriptSegment,
} from '@sessionai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/error-handler.js';

export interface TranscriptRow {
  id: string;
  session_id: string;
  text: string;
  language: string | null;
  segments?: unknown;
  created_at: string;
  updated_at: string;
}

function asSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) return [];
  const out: TranscriptSegment[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as {
      startMs?: unknown;
      endMs?: unknown;
      text?: unknown;
      speaker?: unknown;
    };
    if (typeof row.startMs !== 'number' || typeof row.endMs !== 'number') continue;
    if (typeof row.text !== 'string' || !row.text.trim()) continue;
    out.push({
      startMs: row.startMs,
      endMs: row.endMs,
      text: row.text.trim(),
      speaker: typeof row.speaker === 'string' ? row.speaker : null,
    });
  }
  return out;
}

export function mapTranscriptRow(row: TranscriptRow): Transcript {
  return TranscriptSchema.parse({
    id: row.id,
    sessionId: row.session_id,
    text: row.text,
    language: row.language,
    segments: asSegments(row.segments),
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
    segments?: TranscriptSegment[],
  ): Promise<Transcript>;
  remapSpeakers(
    sessionId: string,
    renames: Record<string, string>,
  ): Promise<Transcript | null>;
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
    segments: TranscriptSegment[] = [],
  ): Promise<Transcript> {
    const { data, error } = await this.client
      .from('transcripts')
      .upsert(
        {
          session_id: sessionId,
          text,
          language,
          segments,
        },
        { onConflict: 'session_id' },
      )
      .select('*')
      .single();

    if (error) {
      const hint = error.message.includes('segments')
        ? ' Apply migration 202609200005_transcript_segments.sql in Supabase.'
        : '';
      throw new AppError('DATABASE_ERROR', `Could not save transcript.${hint}`, 500);
    }

    return mapTranscriptRow(data as TranscriptRow);
  }

  async remapSpeakers(
    sessionId: string,
    renames: Record<string, string>,
  ): Promise<Transcript | null> {
    const existing = await this.getBySessionId(sessionId);
    if (!existing) return null;

    const segments = existing.segments.map((seg) => {
      const key = seg.speaker ?? '';
      const next = renames[key];
      if (!next || !next.trim()) return seg;
      return { ...seg, speaker: next.trim().slice(0, 40) };
    });

    return this.upsertForSession(sessionId, existing.text, existing.language, segments);
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
    segments: TranscriptSegment[] = [],
  ): Promise<Transcript> {
    const existing = this.bySession.get(sessionId);
    const now = new Date().toISOString();
    const row: Transcript = {
      id: existing?.id ?? crypto.randomUUID(),
      sessionId,
      text,
      language,
      segments,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.bySession.set(sessionId, row);
    return row;
  }

  async remapSpeakers(
    sessionId: string,
    renames: Record<string, string>,
  ): Promise<Transcript | null> {
    const existing = await this.getBySessionId(sessionId);
    if (!existing) return null;
    const segments = existing.segments.map((seg) => {
      const key = seg.speaker ?? '';
      const next = renames[key];
      if (!next || !next.trim()) return seg;
      return { ...seg, speaker: next.trim().slice(0, 40) };
    });
    return this.upsertForSession(sessionId, existing.text, existing.language, segments);
  }
}
