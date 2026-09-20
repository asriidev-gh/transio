import type { AudioUploadResult, SignedAudioUrl } from '@sessionai/shared';
import { mobileEnv } from '@/src/lib/env';
import { getCurrentSession } from '@/src/services/auth';
import { ApiClientError, apiGet } from '@/src/services/api';

export interface UploadProgress {
  loaded: number;
  total: number;
  ratio: number;
}

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.startsWith('data:audio/webm') || lower.includes('.webm') || lower.startsWith('blob:')) {
    return 'audio/webm';
  }
  if (lower.startsWith('data:audio/wav') || lower.includes('.wav')) return 'audio/wav';
  if (lower.startsWith('data:audio/mpeg') || lower.includes('.mp3')) return 'audio/mpeg';
  if (lower.startsWith('data:audio/mp4') || lower.startsWith('data:audio/m4a')) return 'audio/mp4';
  if (lower.startsWith('data:')) {
    const match = /^data:([^;,]+)/i.exec(uri);
    if (match?.[1]) return match[1];
  }
  return 'audio/mp4';
}

function guessFileName(uri: string, mimeType: string): string {
  if (mimeType.includes('webm')) return 'audio.webm';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('mpeg')) return 'audio.mp3';
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

        const mimeType = guessMimeType(localUri);
        const fileName = guessFileName(localUri, mimeType);
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
          form.append('file', blob, fileName);
        } else {
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
