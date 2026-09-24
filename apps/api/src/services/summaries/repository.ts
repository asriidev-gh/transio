import {
  SummaryRecordSchema,
  type SessionSummary,
  type SummaryKind,
  type SummaryRecord,
} from '@sessionai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/error-handler.js';

export interface SummaryRow {
  id: string;
  session_id: string;
  kind?: string | null;
  overview: string | null;
  key_points: unknown;
  topics: unknown;
  questions_discussed: unknown;
  action_items: unknown;
  important_insights: unknown;
  quotes: unknown;
  created_at: string;
  updated_at: string;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asTopics(value: unknown): Array<{ title: string; summary: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as { title?: unknown; summary?: unknown };
      if (typeof row.title !== 'string' || typeof row.summary !== 'string') return null;
      return { title: row.title, summary: row.summary };
    })
    .filter((item): item is { title: string; summary: string } => item !== null);
}

function asActionItems(value: unknown): Array<{ task: string; details?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as { task?: unknown; details?: unknown };
      if (typeof row.task !== 'string') return null;
      return {
        task: row.task,
        ...(typeof row.details === 'string' ? { details: row.details } : {}),
      };
    })
    .filter((item): item is { task: string; details?: string } => item !== null);
}

export function mapSummaryRow(row: SummaryRow): SummaryRecord {
  return SummaryRecordSchema.parse({
    id: row.id,
    sessionId: row.session_id,
    overview: row.overview,
    keyPoints: asStringArray(row.key_points),
    topics: asTopics(row.topics),
    questionsDiscussed: asStringArray(row.questions_discussed),
    actionItems: asActionItems(row.action_items),
    importantInsights: asStringArray(row.important_insights),
    quotes: asStringArray(row.quotes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export interface SummaryRepository {
  getBySessionId(
    sessionId: string,
    kind?: SummaryKind,
  ): Promise<SummaryRecord | null>;
  upsertForSession(
    sessionId: string,
    summary: SessionSummary,
    kind?: SummaryKind,
  ): Promise<SummaryRecord>;
}

export class SupabaseSummaryRepository implements SummaryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getBySessionId(
    sessionId: string,
    kind: SummaryKind = 'ai_summary',
  ): Promise<SummaryRecord | null> {
    const { data, error } = await this.client
      .from('summaries')
      .select('*')
      .eq('session_id', sessionId)
      .eq('kind', kind)
      .maybeSingle();

    if (error) {
      // Fallback for DBs that have not applied the kind migration yet.
      if (error.message?.includes('kind') || error.code === '42703') {
        const legacy = await this.client
          .from('summaries')
          .select('*')
          .eq('session_id', sessionId)
          .maybeSingle();
        if (legacy.error) {
          throw new AppError(
            'DATABASE_ERROR',
            `Could not load summary (${legacy.error.message}). Apply migration 202609220001_summary_kinds.sql in Supabase.`,
            500,
          );
        }
        if (!legacy.data) return null;
        return mapSummaryRow(legacy.data as SummaryRow);
      }
      throw new AppError(
        'DATABASE_ERROR',
        `Could not load summary (${error.message}). Apply migration 202609220001_summary_kinds.sql in Supabase.`,
        500,
      );
    }
    if (!data) return null;
    return mapSummaryRow(data as SummaryRow);
  }

  async upsertForSession(
    sessionId: string,
    summary: SessionSummary,
    kind: SummaryKind = 'ai_summary',
  ): Promise<SummaryRecord> {
    const payload = {
      session_id: sessionId,
      kind,
      overview: summary.overview,
      key_points: summary.keyPoints,
      topics: summary.topics,
      questions_discussed: summary.questionsDiscussed,
      action_items: summary.actionItems,
      important_insights: summary.importantInsights,
      quotes: summary.quotes ?? [],
    };

    const { data, error } = await this.client
      .from('summaries')
      .upsert(payload, { onConflict: 'session_id,kind' })
      .select('*')
      .single();

    if (error) {
      // Legacy unique(session_id) fallback
      if (error.message?.includes('kind') || error.code === '42703') {
        const legacy = await this.client
          .from('summaries')
          .upsert(
            {
              session_id: sessionId,
              overview: summary.overview,
              key_points: summary.keyPoints,
              topics: summary.topics,
              questions_discussed: summary.questionsDiscussed,
              action_items: summary.actionItems,
              important_insights: summary.importantInsights,
              quotes: summary.quotes ?? [],
            },
            { onConflict: 'session_id' },
          )
          .select('*')
          .single();
        if (legacy.error) {
          throw new AppError('DATABASE_ERROR', 'Could not save summary', 500);
        }
        return mapSummaryRow(legacy.data as SummaryRow);
      }
      throw new AppError('DATABASE_ERROR', 'Could not save summary', 500);
    }

    return mapSummaryRow(data as SummaryRow);
  }
}

export class InMemorySummaryRepository implements SummaryRepository {
  private readonly byKey = new Map<string, SummaryRecord>();

  private key(sessionId: string, kind: SummaryKind): string {
    return `${sessionId}:${kind}`;
  }

  async getBySessionId(
    sessionId: string,
    kind: SummaryKind = 'ai_summary',
  ): Promise<SummaryRecord | null> {
    return this.byKey.get(this.key(sessionId, kind)) ?? null;
  }

  async upsertForSession(
    sessionId: string,
    summary: SessionSummary,
    kind: SummaryKind = 'ai_summary',
  ): Promise<SummaryRecord> {
    const mapKey = this.key(sessionId, kind);
    const existing = this.byKey.get(mapKey);
    const now = new Date().toISOString();
    const row: SummaryRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      sessionId,
      overview: summary.overview,
      keyPoints: summary.keyPoints,
      topics: summary.topics,
      questionsDiscussed: summary.questionsDiscussed,
      actionItems: summary.actionItems,
      importantInsights: summary.importantInsights,
      quotes: summary.quotes ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.byKey.set(mapKey, row);
    return row;
  }
}
