import { isLikelyMedia } from './media-name';

/** Minimal shape of the share-sheet payload we care about (subset of expo-share-intent). */
export interface SharedIntentLike {
  files?: Array<{ fileName?: string; mimeType?: string; path?: string }> | null;
  text?: string | null;
  webUrl?: string | null;
}

export interface SharedImportParams {
  sharedUri?: string;
  sharedName?: string;
  sharedMime?: string;
  sharedUrl?: string;
}

function toFileUri(path: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : `file://${path}`;
}

function firstHttpUrl(text: string | null | undefined): string | null {
  const match = text?.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

/**
 * Turn an Android share-sheet payload (Zoom / Meet / Drive / Files recording)
 * into new-session import params. Returns null when nothing importable was shared.
 */
export function sharedIntentToImportParams(intent: SharedIntentLike): SharedImportParams | null {
  const file = intent.files?.find(
    (f) => f.path && isLikelyMedia(f.fileName ?? f.path.split('/').pop() ?? '', f.mimeType ?? ''),
  );
  if (file?.path) {
    const name = file.fileName || file.path.split('/').pop() || 'shared-recording';
    return {
      sharedUri: toFileUri(file.path),
      sharedName: name,
      sharedMime: file.mimeType || '',
    };
  }

  const url = intent.webUrl ?? firstHttpUrl(intent.text);
  if (url) return { sharedUrl: url };

  return null;
}
