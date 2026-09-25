import { maxUploadBytes } from '../../lib/limits.js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { safeFetch } from './safe-fetch.js';
import { AppError } from '../../middleware/error-handler.js';
import {
  assertSafeMediaUrl,
  hostnameOf,
  isPrivateOrLocalIp,
  MAX_REMOTE_MEDIA_BYTES,
} from './url-guard.js';

export interface FetchedMedia {
  data: Buffer;
  mimeType: string;
  fileName: string;
}

export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }>;
export type FetchFn = typeof fetch;

const MAX_REDIRECTS = 3;
/** Applies to each request including the body download, so slow-drip hosts cannot hold a slot. */
const REMOTE_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

function fileNameFromUrl(url: URL, contentType: string, contentDisposition: string | null): string {
  const disposition = contentDisposition ?? '';
  const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(disposition);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].replace(/"/g, '').trim());
    } catch {
      return match[1].replace(/"/g, '').trim();
    }
  }
  const last = url.pathname.split('/').filter(Boolean).pop();
  if (last && last.includes('.')) {
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'audio.mp3';
  if (contentType.includes('webm')) return 'media.webm';
  if (contentType.includes('wav')) return 'audio.wav';
  return 'media.mp4';
}

async function assertResolvedPublic(url: URL, lookupFn: LookupFn): Promise<void> {
  const host = hostnameOf(url);
  if (isIP(host)) {
    if (isPrivateOrLocalIp(host)) {
      throw new AppError('VALIDATION_ERROR', 'Local URLs cannot be imported', 400);
    }
    return;
  }

  try {
    const resolved = await lookupFn(host);
    if (isPrivateOrLocalIp(resolved.address)) {
      throw new AppError('VALIDATION_ERROR', 'Local URLs cannot be imported', 400);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('VALIDATION_ERROR', 'Could not resolve that media host', 400);
  }
}

/**
 * Download a direct media file. Refuses page hosts (YouTube, …) and private IPs.
 */
export async function fetchRemoteMedia(
  rawUrl: string,
  options: { fetchImpl?: FetchFn; lookupFn?: LookupFn } = {},
): Promise<FetchedMedia> {
  const fetchImpl = options.fetchImpl ?? safeFetch;
  const lookupFn = options.lookupFn ?? ((hostname: string) => lookup(hostname));

  let current = assertSafeMediaUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertResolvedPublic(current, lookupFn);

    let response: Response;
    try {
      response = await fetchImpl(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: { Accept: 'audio/*,video/*,*/*' },
        signal: AbortSignal.timeout(REMOTE_DOWNLOAD_TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        'VALIDATION_ERROR',
        'Could not download that URL. Check the link and try again.',
        400,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || hop === MAX_REDIRECTS) {
        throw new AppError('VALIDATION_ERROR', 'Media URL redirected too many times', 400);
      }
      current = assertSafeMediaUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Could not download that file (HTTP ${response.status}).`,
        400,
      );
    }

    const lengthHeader = response.headers.get('content-length');
    if (lengthHeader) {
      const length = Number(lengthHeader);
      if (Number.isFinite(length) && length > MAX_REMOTE_MEDIA_BYTES) {
        throw new AppError('VALIDATION_ERROR', `Remote file is too large (max ${Math.round(maxUploadBytes() / (1024 * 1024))} MB)`, 400);
      }
    }

    const mimeType =
      (response.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]?.trim().toLowerCase() ||
      'application/octet-stream';
    const fileName = fileNameFromUrl(current, mimeType, response.headers.get('content-disposition'));

    const chunks: Buffer[] = [];
    let total = 0;
    if (!response.body) {
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.byteLength > MAX_REMOTE_MEDIA_BYTES) {
        throw new AppError('VALIDATION_ERROR', `Remote file is too large (max ${Math.round(maxUploadBytes() / (1024 * 1024))} MB)`, 400);
      }
      return { data: buf, mimeType, fileName };
    }

    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_REMOTE_MEDIA_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new AppError('VALIDATION_ERROR', `Remote file is too large (max ${Math.round(maxUploadBytes() / (1024 * 1024))} MB)`, 400);
      }
      chunks.push(Buffer.from(value));
    }

    return { data: Buffer.concat(chunks), mimeType, fileName };
  }

  throw new AppError('VALIDATION_ERROR', 'Could not download that URL', 400);
}
