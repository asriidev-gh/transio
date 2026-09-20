import {
  SESSION_AUDIO_BUCKET,
  buildSessionAudioPath,
  extensionFromMimeType,
} from '@sessionai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/error-handler.js';

export interface AudioStorage {
  upload(path: string, data: Buffer, contentType: string): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}

export class SupabaseAudioStorage implements AudioStorage {
  constructor(private readonly client: SupabaseClient) {}

  async upload(path: string, data: Buffer, contentType: string): Promise<void> {
    const { error } = await this.client.storage.from(SESSION_AUDIO_BUCKET).upload(path, data, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new AppError(
        'STORAGE_ERROR',
        `Could not upload audio file (${error.message})`,
        500,
      );
    }
  }

  async createSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(SESSION_AUDIO_BUCKET)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new AppError('STORAGE_ERROR', 'Could not create signed audio URL', 500);
    }

    return data.signedUrl;
  }
}

/** In-memory storage for unit tests. */
export class InMemoryAudioStorage implements AudioStorage {
  readonly files = new Map<string, { data: Buffer; contentType: string }>();

  async upload(path: string, data: Buffer, contentType: string): Promise<void> {
    this.files.set(path, { data, contentType });
  }

  async createSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    if (!this.files.has(path)) {
      throw new AppError('STORAGE_ERROR', 'Could not create signed audio URL', 500);
    }
    return `https://signed.example/${encodeURIComponent(path)}?exp=${expiresInSeconds}`;
  }
}

export function resolveUploadPath(
  userId: string,
  sessionId: string,
  mimeType: string | undefined,
  originalName?: string,
): string {
  const fromName = originalName?.split('.').pop();
  const extension =
    fromName && fromName.length <= 5 && !fromName.includes('/')
      ? fromName
      : extensionFromMimeType(mimeType);
  return buildSessionAudioPath(userId, sessionId, extension);
}
