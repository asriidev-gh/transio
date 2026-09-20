import { getEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { withProviderRetry } from '../../lib/retry.js';
import { AppError } from '../../middleware/error-handler.js';
import type { TranscriptionInput, TranscriptionProvider, TranscriptionResult } from './types.js';

/**
 * OpenAI Whisper-compatible HTTP transcription provider.
 * Configure with TRANSCRIPTION_API_KEY and optional TRANSCRIPTION_BASE_URL.
 */
export class HttpTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'http-whisper';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    return withProviderRetry(async (attempt) => {
      const endpoint = `${this.baseUrl.replace(/\/$/, '')}/audio/transcriptions`;
      const form = new FormData();
      const bytes = new Uint8Array(input.audio);
      const blob = new Blob([bytes], { type: input.mimeType || 'application/octet-stream' });
      form.append('file', blob, input.fileName || 'audio.m4a');
      form.append('model', 'whisper-1');
      form.append('response_format', 'verbose_json');
      if (input.language) {
        form.append('language', input.language);
      }

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: form,
        });
      } catch {
        throw new AppError(
          'TRANSCRIPTION_ERROR',
          'Could not reach the transcription provider',
          502,
        );
      }

      if (!response.ok) {
        logger.warn('Transcription provider returned error', {
          status: response.status,
          provider: this.name,
          attempt,
        });
        if (response.status === 429) {
          throw new AppError(
            'TRANSCRIPTION_ERROR',
            'Transcription provider is rate-limited. Please retry in a moment.',
            429,
          );
        }
        throw new AppError(
          'TRANSCRIPTION_ERROR',
          'Transcription provider request failed',
          response.status >= 500 ? 502 : 502,
        );
      }

      const payload = (await response.json()) as { text?: string; language?: string };
      const text = payload.text?.trim();
      if (!text) {
        throw new AppError(
          'TRANSCRIPTION_ERROR',
          'Transcription provider returned empty text',
          502,
        );
      }

      return {
        text,
        language: payload.language ?? input.language ?? null,
      };
    });
  }
}

/** Test-only provider with deterministic output. */
export class FakeTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'fake';

  constructor(private readonly text = 'This is a test transcript.') {}

  async transcribe(_input: TranscriptionInput): Promise<TranscriptionResult> {
    return { text: this.text, language: 'en' };
  }
}

export function createTranscriptionProvider(): TranscriptionProvider {
  const env = getEnv();
  const baseUrl = env.TRANSCRIPTION_BASE_URL.trim() || 'https://api.openai.com/v1';

  if (!env.TRANSCRIPTION_API_KEY) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'Transcription is not configured. Set TRANSCRIPTION_API_KEY on the API.',
      503,
    );
  }

  return new HttpTranscriptionProvider(env.TRANSCRIPTION_API_KEY, baseUrl);
}
