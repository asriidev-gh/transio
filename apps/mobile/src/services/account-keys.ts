/** Kept after deletion so deleting and re-creating an account cannot reset local usage counters. */
const KEEP_KEY_PREFIXES = ['smart-transcriber-entitlements'];

/** Whether a stored key should be wiped after an account is deleted. */
export function shouldClearKeyAfterDeletion(key: string): boolean {
  return !KEEP_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}
