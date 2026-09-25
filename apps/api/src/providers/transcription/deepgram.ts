import { PROVIDER_TIMEOUT_MS } from '../../lib/timeouts.js';
import { logger } from '../../lib/logger.js';
import { withProviderRetry } from '../../lib/retry.js';
import { AppError } from '../../middleware/error-handler.js';
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionSegment,
} from './types.js';

interface DeepgramUtterance {
  start?: number;
  end?: number;
  transcript?: string;
  speaker?: number;
}

interface DeepgramPayload {
  results?: {
    utterances?: DeepgramUtterance[];
    channels?: Array<{
      detected_language?: string;
      alternatives?: Array<{ transcript?: string }>;
    }>;
  };
}

const DEEPGRAM_LISTEN_URL = 'https://api.deepgram.com/v1/listen';

/** 0 -> "Speaker A", 1 -> "Speaker B", ... 26+ -> "Speaker 27". */
export function speakerLabel(index: number): string {
  if (index >= 0 && index < 26) return `Speaker ${String.fromCharCode(65 + index)}`;
  return `Speaker ${index + 1}`;
}

/** Map Deepgram utterances (acoustic diarization) into transcript segments. */
export function mapDeepgramUtterances(
  raw: DeepgramUtterance[] | undefined,
): TranscriptionSegment[] {
  if (!raw?.length) return [];
  const segments: TranscriptionSegment[] = [];
  for (const u of raw) {
    const text = typeof u.transcript === 'string' ? u.transcript.trim() : '';
    if (!text) continue;
    const startMs = Math.max(0, Math.round((u.start ?? 0) * 1000));
    const endMs = Math.max(startMs, Math.round((u.end ?? u.start ?? 0) * 1000));
    segments.push({
      startMs,
      endMs,
      text,
      speaker: typeof u.speaker === 'number' ? speakerLabel(u.speaker) : null,
    });
  }
  return segments;
}

/**
 * Deepgram pre-recorded transcription with real speaker diarization.
 * Better than Whisper for meetings: multiple speakers, large files.
 */
export class DeepgramTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'deepgram';

  constructor(
    private readonly apiKey: string,
    private readonly model = 'nova-3',
  ) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    return withProviderRetry(async (attempt) => {
      const params = new URLSearchParams({
        model: this.model,
        smart_format: 'true',
        punctuate: 'true',
        diarize: 'true',
        utterances: 'true',
      });
      if (input.language) params.set('language', input.language);
      else params.set('detect_language', 'true');

      let response: Response;
      try {
        response = await fetch(`${DEEPGRAM_LISTEN_URL}?${params.toString()}`, {
          method: 'POST',
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS.deepgram),
          headers: {
            Authorization: `Token ${this.apiKey}`,
            'Content-Type': input.mimeType || 'application/octet-stream',
          },
          body: new Uint8Array(input.audio),
        });
      } catch {
        throw new AppError(
          'TRANSCRIPTION_ERROR',
          'Could not reach the transcription provider',
          502,
        );
      }

      if (!response.ok) {
        let detail = '';
        try {
          detail = (await response.text()).slice(0, 240);
        } catch {
          // ignore
        }
        logger.warn('Transcription provider returned error', {
          status: response.status,
          provider: this.name,
          attempt,
          detail: detail || undefined,
        });
        if (response.status === 429) {
          throw new AppError(
            'TRANSCRIPTION_ERROR',
            'Transcription provider is rate-limited. Please retry in a moment.',
            429,
          );
        }
        if (response.status >= 400 && response.status < 500) {
          throw new AppError(
            'TRANSCRIPTION_ERROR',
            'Could not transcribe that recording. Check the file has audible speech.',
            400,
          );
        }
        throw new AppError('TRANSCRIPTION_ERROR', 'Transcription provider request failed', 502);
      }

      const payload = (await response.json()) as DeepgramPayload;
      const channel = payload.results?.channels?.[0];
      const segments = mapDeepgramUtterances(payload.results?.utterances);
      const text =
        channel?.alternatives?.[0]?.transcript?.trim() ||
        segments.map((s) => s.text).join(' ').trim();

      if (!text) {
        throw new AppError(
          'TRANSCRIPTION_ERROR',
          'Transcription provider returned empty text',
          502,
        );
      }

      return {
        text,
        language: channel?.detected_language ?? input.language ?? null,
        segments,
        diarized: segments.some((s) => s.speaker),
      };
    });
  }
}
