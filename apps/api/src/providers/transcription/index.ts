import { getEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { withProviderRetry } from '../../lib/retry.js';
import { AppError } from '../../middleware/error-handler.js';
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionSegment,
} from './types.js';

interface WhisperVerboseSegment {
  start?: number;
  end?: number;
  text?: string;
}

interface WhisperVerbosePayload {
  text?: string;
  language?: string;
  segments?: WhisperVerboseSegment[];
}

const SPEAKER_GAP_MS = 1200;

/**
 * Map Whisper timed segments into SessionAI segments.
 * Speaker labels are pause-heuristic only (not true diarization).
 */
export function mapWhisperSegments(
  raw: WhisperVerboseSegment[] | undefined,
): TranscriptionSegment[] {
  if (!raw?.length) return [];

  const timed = raw
    .map((seg) => {
      const text = typeof seg.text === 'string' ? seg.text.trim() : '';
      if (!text) return null;
      const startMs = Math.max(0, Math.round((seg.start ?? 0) * 1000));
      const endMs = Math.max(startMs, Math.round((seg.end ?? seg.start ?? 0) * 1000));
      return { startMs, endMs, text };
    })
    .filter((seg): seg is { startMs: number; endMs: number; text: string } => seg !== null);

  let speakerIndex = 0;
  let previousEnd = -SPEAKER_GAP_MS;

  return timed.map((seg) => {
    if (seg.startMs - previousEnd >= SPEAKER_GAP_MS) {
      // Keep first speaker on the opening gap; rotate afterward.
      if (previousEnd >= 0) {
        speakerIndex = (speakerIndex + 1) % 2;
      }
    }
    previousEnd = seg.endMs;
    return {
      ...seg,
      speaker: speakerIndex === 0 ? 'Speaker A' : 'Speaker B',
    };
  });
}

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

      const payload = (await response.json()) as WhisperVerbosePayload;
      const text = payload.text?.trim();
      if (!text) {
        throw new AppError(
          'TRANSCRIPTION_ERROR',
          'Transcription provider returned empty text',
          502,
        );
      }

      const segments = mapWhisperSegments(payload.segments);

      return {
        text,
        language: payload.language ?? input.language ?? null,
        segments,
      };
    });
  }
}

/** Test-only provider with deterministic output. */
export class FakeTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'fake';

  constructor(private readonly text = 'This is a test transcript.') {}

  async transcribe(_input: TranscriptionInput): Promise<TranscriptionResult> {
    return {
      text: this.text,
      language: 'en',
      segments: [
        {
          startMs: 0,
          endMs: 2000,
          text: this.text,
          speaker: 'Speaker A',
        },
      ],
    };
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
