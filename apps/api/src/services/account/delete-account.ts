import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../middleware/error-handler.js';

const AUDIO_BUCKET = 'session-audio';
const PAGE_SIZE = 100;

type Storage = ReturnType<SupabaseClient['storage']['from']>;
interface StorageEntry {
  name: string;
  /** Files have an id; folders do not. */
  id: string | null;
}

async function listAll(storage: Storage, prefix: string): Promise<StorageEntry[]> {
  const entries: StorageEntry[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await storage.list(prefix, { limit: PAGE_SIZE, offset });
    if (error) {
      throw new AppError('STORAGE_ERROR', 'Could not list your recordings for deletion', 500);
    }
    const page = (data ?? []) as StorageEntry[];
    entries.push(...page);
    if (page.length < PAGE_SIZE) return entries;
  }
}

/**
 * Remove every stored recording for a user. Files live at `{userId}/{sessionId}/audio.*`.
 * Returns how many files were removed. Throws if anything could not be removed.
 */
export async function deleteUserAudio(client: SupabaseClient, userId: string): Promise<number> {
  const storage = client.storage.from(AUDIO_BUCKET);
  const paths: string[] = [];

  for (const entry of await listAll(storage, userId)) {
    if (entry.id) {
      paths.push(`${userId}/${entry.name}`);
      continue;
    }
    for (const file of await listAll(storage, `${userId}/${entry.name}`)) {
      if (file.id) paths.push(`${userId}/${entry.name}/${file.name}`);
    }
  }

  for (let i = 0; i < paths.length; i += PAGE_SIZE) {
    const { error } = await storage.remove(paths.slice(i, i + PAGE_SIZE));
    if (error) {
      throw new AppError('STORAGE_ERROR', 'Could not delete your recordings', 500);
    }
  }
  return paths.length;
}

/**
 * Permanently delete an account. Recordings go first, and the login is deleted only after they
 * are gone, so a failure leaves the account intact and the user can simply retry. Sessions,
 * transcripts, summaries, folders, feedback and usage rows are removed by database cascades
 * from the login.
 */
export async function deleteAccount(client: SupabaseClient, userId: string): Promise<void> {
  const removedFiles = await deleteUserAudio(client, userId);

  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) {
    logger.error('Account deletion failed at the login step', { message: error.message });
    throw new AppError('ACCOUNT_DELETE_FAILED', 'Could not delete your account. Please try again.', 500);
  }

  logger.info('Account deleted', { removedFiles });
}
