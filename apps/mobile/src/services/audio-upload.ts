import type { AudioUploadResult, SignedAudioUrl } from '@sessionai/shared';
import { mobileEnv } from '@/src/lib/env';
import { getCurrentSession } from '@/src/services/auth';
import { ApiClientError, apiGet, apiRequest } from '@/src/services/api';

export interface UploadProgress {
  loaded: number;
  total: number;
  ratio: number;
}

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.startsWith('data:')) {
    const match = /^data:([^;,]+)/i.exec(uri);
    if (match?.[1]) return match[1];
  }
  if (lower.includes('.webm')) return 'audio/webm';
  if (lower.includes('.wav')) return 'audio/wav';
  if (lower.includes('.mp3')) return 'audio/mpeg';
  if (lower.includes('.ogg') || lower.includes('.oga')) return 'audio/ogg';
  if (lower.includes('.aac')) return 'audio/aac';
  if (lower.includes('.mov')) return 'video/quicktime';
  if (lower.includes('.mkv')) return 'video/x-matroska';
  if (lower.includes('.m4a') || lower.includes('.caf')) return 'audio/mp4';
  if (lower.includes('.mp4') || lower.includes('.m4v')) return 'video/mp4';
  // Browser MediaRecorder output is usually webm; imports should carry type on the Blob.
  if (lower.startsWith('blob:')) return 'audio/webm';
  return 'audio/mp4';
}

function guessFileName(uri: string, mimeType: string): string {
  if (mimeType.includes('webm')) return 'audio.webm';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('mpeg')) return 'audio.mp3';
  if (mimeType.includes('ogg')) return 'audio.ogg';
  if (mimeType.includes('aac')) return 'audio.aac';
  if (mimeType.includes('quicktime') || mimeType.includes('mov')) return 'video.mov';
  if (mimeType.startsWith('video/') && mimeType.includes('mp4')) return 'video.mp4';
  if (uri.includes('.')) {
    const part = uri.split('.').pop();
    if (part && part.length <= 5) return `audio.${part.split('?')[0]}`;
  }
  return 'audio.m4a';
}

/**
 * Uploads a local recording to POST /sessions/:id/audio with progress callbacks.
 * Uses XMLHttpRequest because fetch does not expose upload progress reliably.
 */
export function uploadSessionAudio(
  sessionId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<AudioUploadResult> {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const token = (await getCurrentSession())?.access_token;
        if (!token) {
          reject(new ApiClientError('UNAUTHORIZED', 'You must be signed in.', 401));
          return;
        }

        const form = new FormData();

        // React Native FormData file shape; on web, materialize blob/data URLs first.
        if (
          localUri.startsWith('blob:') ||
          localUri.startsWith('http') ||
          localUri.startsWith('data:')
        ) {
          let blob: Blob;
          try {
            const res = await fetch(localUri);
            if (!res.ok) {
              throw new Error('unreachable');
            }
            blob = await res.blob();
          } catch {
            reject(
              new ApiClientError(
                'LOCAL_AUDIO_MISSING',
                'Local recording is no longer available in this browser. Please record again.',
                0,
              ),
            );
            return;
          }
          const mimeType = blob.type || guessMimeType(localUri);
          const fileName = guessFileName(localUri, mimeType);
          const typed =
            blob.type && blob.type.length > 0
              ? blob
              : new Blob([blob], { type: mimeType });
          form.append('file', typed, fileName);
        } else {
          const mimeType = guessMimeType(localUri);
          const fileName = guessFileName(localUri, mimeType);
          form.append('file', {
            uri: localUri,
            name: fileName,
            type: mimeType,
          } as unknown as Blob);
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${mobileEnv.apiBaseUrl.replace(/\/$/, '')}/sessions/${sessionId}/audio`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Accept', 'application/json');

        xhr.upload.onprogress = (event) => {
          if (!onProgress) return;
          const total = event.lengthComputable ? event.total : 0;
          const loaded = event.loaded;
          onProgress({
            loaded,
            total,
            ratio: total > 0 ? Math.min(1, loaded / total) : 0,
          });
        };

        xhr.onerror = () => {
          reject(new ApiClientError('NETWORK_ERROR', 'Upload failed. Check your connection.', 0));
        };

        xhr.onload = () => {
          let parsed: {
            success?: boolean;
            data?: AudioUploadResult;
            error?: { code: string; message: string };
          } = {};
          try {
            parsed = JSON.parse(xhr.responseText) as typeof parsed;
          } catch {
            reject(new ApiClientError('REQUEST_FAILED', 'Invalid upload response', xhr.status));
            return;
          }

          if (xhr.status >= 200 && xhr.status < 300 && parsed.success && parsed.data) {
            resolve(parsed.data);
            return;
          }

          reject(
            new ApiClientError(
              parsed.error?.code ?? 'REQUEST_FAILED',
              parsed.error?.message ?? 'Upload failed',
              xhr.status,
            ),
          );
        };

        xhr.send(form);
      } catch (err) {
        reject(
          err instanceof ApiClientError
            ? err
            : new ApiClientError('NETWORK_ERROR', 'Upload failed. Check your connection.', 0),
        );
      }
    })();
  });
}

export async function getSignedAudioUrl(sessionId: string): Promise<SignedAudioUrl> {
  return apiGet<SignedAudioUrl>(`/sessions/${sessionId}/audio-url`, true);
}

/** Fetch a direct media URL on the server, store it, and mark the session uploaded. */
export async function importSessionMediaFromUrl(
  sessionId: string,
  url: string,
): Promise<AudioUploadResult> {
  return apiRequest<AudioUploadResult>(`/sessions/${sessionId}/import-url`, {
    method: 'POST',
    body: { url },
    auth: true,
    retries: 0,
  });
}
