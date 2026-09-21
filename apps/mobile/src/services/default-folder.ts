import type { SessionFolder } from '@sessionai/shared';
import { createFolder, listFolders } from '@/src/services/folders';

/** Built-in destination when the user doesn’t pick another folder. */
export const DEFAULT_FOLDER_NAME = 'Default';

export function normalizeFolderName(name: string): string {
  return name.trim().toLowerCase();
}

export function isDefaultFolder(folder: Pick<SessionFolder, 'name'>): boolean {
  return normalizeFolderName(folder.name) === normalizeFolderName(DEFAULT_FOLDER_NAME);
}

export function findFolderByName(
  folders: SessionFolder[],
  name: string,
): SessionFolder | undefined {
  const key = normalizeFolderName(name);
  return folders.find((folder) => normalizeFolderName(folder.name) === key);
}

/** Keep one folder per name (oldest wins) and sort Default first. */
export function dedupeFoldersByName(folders: SessionFolder[]): SessionFolder[] {
  const byName = new Map<string, SessionFolder>();
  const chronological = [...folders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const folder of chronological) {
    const key = normalizeFolderName(folder.name);
    if (!byName.has(key)) byName.set(key, folder);
  }
  return sortFoldersWithDefaultFirst([...byName.values()]);
}

/** Find or create the user’s Default folder (never creates a duplicate). */
export async function ensureDefaultFolder(
  existing?: SessionFolder[],
): Promise<SessionFolder> {
  const list = existing ?? (await listFolders());
  const found = findFolderByName(list, DEFAULT_FOLDER_NAME);
  if (found) return found;
  try {
    return await createFolder({ name: DEFAULT_FOLDER_NAME });
  } catch {
    // Race: another call created Default — reload and use it.
    const refreshed = await listFolders();
    const again = findFolderByName(refreshed, DEFAULT_FOLDER_NAME);
    if (again) return again;
    throw new Error('Could not create the Default folder.');
  }
}

/** Sort Default first, then A–Z. */
export function sortFoldersWithDefaultFirst(folders: SessionFolder[]): SessionFolder[] {
  return [...folders].sort((a, b) => {
    const aDefault = isDefaultFolder(a);
    const bDefault = isDefaultFolder(b);
    if (aDefault && !bDefault) return -1;
    if (!aDefault && bDefault) return 1;
    return a.name.localeCompare(b.name);
  });
}
