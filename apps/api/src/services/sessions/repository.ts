import type { CreateSessionInput, Session, UpdateSessionInput } from '@sessionai/shared';
import { SessionSchema } from '@sessionai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/error-handler.js';
import { mapSessionRow, type SessionRow } from './mapper.js';

export interface SessionRepository {
  list(userId: string): Promise<Session[]>;
  getById(userId: string, id: string): Promise<Session | null>;
  create(userId: string, input: CreateSessionInput): Promise<Session>;
  update(userId: string, id: string, input: UpdateSessionInput): Promise<Session | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

/**
 * Supabase-backed repository.
 * Uses the caller-scoped client (user JWT) so RLS applies; also filters by user_id.
 */
export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(userId: string): Promise<Session[]> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false });

    if (error) {
      throw new AppError('DATABASE_ERROR', 'Could not load sessions', 500);
    }

    return (data as SessionRow[]).map((row) => SessionSchema.parse(mapSessionRow(row)));
  }

  async getById(userId: string, id: string): Promise<Session | null> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new AppError('DATABASE_ERROR', 'Could not load session', 500);
    }

    if (!data) {
      return null;
    }

    return SessionSchema.parse(mapSessionRow(data as SessionRow));
  }

  async create(userId: string, input: CreateSessionInput): Promise<Session> {
    const payload = {
      user_id: userId,
      title: input.title,
      session_type: input.sessionType,
      description: input.description?.trim() ? input.description.trim() : null,
      recorded_at: input.recordedAt ?? new Date().toISOString(),
      status: 'recording',
    };

    const { data, error } = await this.client.from('sessions').insert(payload).select('*').single();

    if (error) {
      throw new AppError('DATABASE_ERROR', 'Could not create session', 500);
    }

    return SessionSchema.parse(mapSessionRow(data as SessionRow));
  }

  async update(userId: string, id: string, input: UpdateSessionInput): Promise<Session | null> {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.sessionType !== undefined) patch.session_type = input.sessionType;
    if (input.description !== undefined) {
      patch.description = input.description?.trim() ? input.description.trim() : null;
    }
    if (input.recordedAt !== undefined) patch.recorded_at = input.recordedAt;
    if (input.durationSeconds !== undefined) patch.duration_seconds = input.durationSeconds;
    if (input.audioPath !== undefined) patch.audio_path = input.audioPath;
    if (input.status !== undefined) patch.status = input.status;
    if (input.favoritedAt !== undefined) patch.favorited_at = input.favoritedAt;

    const { data, error } = await this.client
      .from('sessions')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      const hint = error.message.includes('favorited_at')
        ? ' Apply migration 202609200006_session_favorites.sql in Supabase.'
        : '';
      throw new AppError('DATABASE_ERROR', `Could not update session.${hint}`, 500);
    }

    if (!data) {
      return null;
    }

    return SessionSchema.parse(mapSessionRow(data as SessionRow));
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new AppError('DATABASE_ERROR', 'Could not delete session', 500);
    }

    return Boolean(data);
  }
}

/** In-memory repository for unit tests (no network / Supabase). */
export class InMemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, Session>();

  async list(userId: string): Promise<Session[]> {
    return [...this.rows.values()]
      .filter((session) => session.userId === userId)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }

  async getById(userId: string, id: string): Promise<Session | null> {
    const session = this.rows.get(id);
    if (!session || session.userId !== userId) {
      return null;
    }
    return session;
  }

  async create(userId: string, input: CreateSessionInput): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      title: input.title,
      sessionType: input.sessionType,
      description: input.description?.trim() ? input.description.trim() : null,
      recordedAt: input.recordedAt ?? now,
      durationSeconds: null,
      audioPath: null,
      status: 'recording',
      favoritedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(session.id, session);
    return session;
  }

  async update(userId: string, id: string, input: UpdateSessionInput): Promise<Session | null> {
    const existing = await this.getById(userId, id);
    if (!existing) {
      return null;
    }

    const updated: Session = {
      ...existing,
      title: input.title ?? existing.title,
      sessionType: input.sessionType ?? existing.sessionType,
      description:
        input.description !== undefined
          ? input.description?.trim()
            ? input.description.trim()
            : null
          : existing.description,
      recordedAt: input.recordedAt ?? existing.recordedAt,
      durationSeconds:
        input.durationSeconds !== undefined ? input.durationSeconds : existing.durationSeconds,
      audioPath: input.audioPath !== undefined ? input.audioPath : existing.audioPath,
      status: input.status ?? existing.status,
      favoritedAt:
        input.favoritedAt !== undefined ? input.favoritedAt : existing.favoritedAt,
      updatedAt: new Date().toISOString(),
    };

    this.rows.set(id, updated);
    return updated;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = await this.getById(userId, id);
    if (!existing) {
      return false;
    }
    this.rows.delete(id);
    return true;
  }
}
