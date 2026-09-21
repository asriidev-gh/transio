import type { CreateFolderInput, SessionFolder, UpdateFolderInput } from '@sessionai/shared';
import { SessionFolderSchema } from '@sessionai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/error-handler.js';

export interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function mapFolderRow(row: FolderRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface FolderRepository {
  list(userId: string): Promise<SessionFolder[]>;
  getById(userId: string, id: string): Promise<SessionFolder | null>;
  create(userId: string, input: CreateFolderInput): Promise<SessionFolder>;
  update(userId: string, id: string, input: UpdateFolderInput): Promise<SessionFolder | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

export class SupabaseFolderRepository implements FolderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(userId: string): Promise<SessionFolder[]> {
    const { data, error } = await this.client
      .from('session_folders')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      const hint = error.message.includes('session_folders')
        ? ' Apply migration 202609210001_session_folders.sql in Supabase.'
        : '';
      throw new AppError('DATABASE_ERROR', `Could not load folders.${hint}`, 500);
    }

    return (data as FolderRow[]).map((row) => SessionFolderSchema.parse(mapFolderRow(row)));
  }

  async getById(userId: string, id: string): Promise<SessionFolder | null> {
    const { data, error } = await this.client
      .from('session_folders')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new AppError('DATABASE_ERROR', 'Could not load folder', 500);
    }
    if (!data) return null;
    return SessionFolderSchema.parse(mapFolderRow(data as FolderRow));
  }

  async create(userId: string, input: CreateFolderInput): Promise<SessionFolder> {
    const { data: existing, error: existingError } = await this.client
      .from('session_folders')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', input.name.trim())
      .maybeSingle();

    if (existingError) {
      throw new AppError('DATABASE_ERROR', 'Could not validate folder name', 500);
    }
    if (existing) {
      throw new AppError('CONFLICT', 'A folder with this name already exists.', 409);
    }

    const { data, error } = await this.client
      .from('session_folders')
      .insert({ user_id: userId, name: input.name.trim() })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('CONFLICT', 'A folder with this name already exists.', 409);
      }
      const hint = error.message.includes('session_folders')
        ? ' Apply migration 202609210001_session_folders.sql in Supabase.'
        : '';
      throw new AppError('DATABASE_ERROR', `Could not create folder.${hint}`, 500);
    }

    return SessionFolderSchema.parse(mapFolderRow(data as FolderRow));
  }

  async update(userId: string, id: string, input: UpdateFolderInput): Promise<SessionFolder | null> {
    const trimmed = input.name.trim();
    const { data: clash, error: clashError } = await this.client
      .from('session_folders')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', trimmed)
      .neq('id', id)
      .maybeSingle();

    if (clashError) {
      throw new AppError('DATABASE_ERROR', 'Could not validate folder name', 500);
    }
    if (clash) {
      throw new AppError('CONFLICT', 'A folder with this name already exists.', 409);
    }

    const { data, error } = await this.client
      .from('session_folders')
      .update({ name: trimmed })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('CONFLICT', 'A folder with this name already exists.', 409);
      }
      throw new AppError('DATABASE_ERROR', 'Could not update folder', 500);
    }
    if (!data) return null;
    return SessionFolderSchema.parse(mapFolderRow(data as FolderRow));
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('session_folders')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new AppError('DATABASE_ERROR', 'Could not delete folder', 500);
    }
    return Boolean(data);
  }
}

export class InMemoryFolderRepository implements FolderRepository {
  private readonly rows = new Map<string, SessionFolder>();

  async list(userId: string): Promise<SessionFolder[]> {
    return [...this.rows.values()]
      .filter((folder) => folder.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(userId: string, id: string): Promise<SessionFolder | null> {
    const folder = this.rows.get(id);
    if (!folder || folder.userId !== userId) return null;
    return folder;
  }

  async create(userId: string, input: CreateFolderInput): Promise<SessionFolder> {
    const key = input.name.trim().toLowerCase();
    for (const folder of this.rows.values()) {
      if (folder.userId === userId && folder.name.trim().toLowerCase() === key) {
        throw new AppError('CONFLICT', 'A folder with this name already exists.', 409);
      }
    }
    const now = new Date().toISOString();
    const folder: SessionFolder = {
      id: crypto.randomUUID(),
      userId,
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(folder.id, folder);
    return folder;
  }

  async update(userId: string, id: string, input: UpdateFolderInput): Promise<SessionFolder | null> {
    const existing = await this.getById(userId, id);
    if (!existing) return null;
    const updated: SessionFolder = {
      ...existing,
      name: input.name,
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = await this.getById(userId, id);
    if (!existing) return false;
    this.rows.delete(id);
    return true;
  }
}
