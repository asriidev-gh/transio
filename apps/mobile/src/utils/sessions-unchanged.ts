import type { Session } from '@sessionai/shared';

/**
 * True when a refetched list is identical to the one on screen. `updatedAt` changes on every
 * edit, so id + updatedAt in the same order is enough. Returning the previous array from
 * setState then skips a full re-render of the list.
 */
export function sessionsUnchanged(
  prev: ReadonlyArray<Pick<Session, 'id' | 'updatedAt'>>,
  next: ReadonlyArray<Pick<Session, 'id' | 'updatedAt'>>,
): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i]?.id !== next[i]?.id || prev[i]?.updatedAt !== next[i]?.updatedAt) return false;
  }
  return true;
}
