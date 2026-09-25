/**
 * The API refuses a request when a usage limit is reached. Those refusals can happen in any
 * screen, so they are published here and handled once, at the app root.
 */
export type QuotaBlockKind = 'paywall' | 'daily' | 'paused' | 'device';

export interface QuotaBlock {
  kind: QuotaBlockKind;
  message: string;
}

/** Maps an API error code to what the app should do. Null for every other error. */
export function classifyQuotaError(code: string): QuotaBlockKind | null {
  switch (code) {
    case 'QUOTA_EXCEEDED_FREE':
      return 'paywall';
    case 'QUOTA_EXCEEDED_DAILY':
      return 'daily';
    case 'SERVICE_PAUSED':
      return 'paused';
    case 'DEVICE_ALREADY_CLAIMED':
      return 'device';
    default:
      return null;
  }
}

type Listener = (block: QuotaBlock) => void;
const listeners = new Set<Listener>();

export function subscribeQuotaBlocked(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Publish a block when the error code is a quota refusal. Safe to call with any error. */
export function publishIfQuotaBlocked(code: string, message: string): void {
  const kind = classifyQuotaError(code);
  if (!kind) return;
  for (const listener of listeners) listener({ kind, message });
}
