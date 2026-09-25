import { PROVIDER_TIMEOUT_MS } from '../../lib/timeouts.js';
import { getEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { withProviderRetry } from '../../lib/retry.js';
import { AppError } from '../../middleware/error-handler.js';
import type { TranscriptionSegment } from '../transcription/types.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-5';
const MAX_SEGMENTS = 80;

export interface SpeakerLabelInput {
  title: string;
  sessionType?: string;
  segments: TranscriptionSegment[];
}

export interface SpeakerLabelProvider {
  readonly name: string;
  label(input: SpeakerLabelInput): Promise<TranscriptionSegment[]>;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate) as unknown;
}

/**
 * Context-based speaker labeling (not acoustic diarization).
 * Uses Claude to assign consistent speaker names from dialogue content.
 */
export class ClaudeSpeakerLabelProvider implements SpeakerLabelProvider {
  readonly name = 'claude-speakers';

  constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_MODEL,
  ) {}

  async label(input: SpeakerLabelInput): Promise<TranscriptionSegment[]> {
    if (input.segments.length === 0) return [];

    const slice = input.segments.slice(0, MAX_SEGMENTS);
    const numbered = slice
      .map((seg, i) => `${i}|${seg.startMs}-${seg.endMs}|${seg.text}`)
      .join('\n');

    return withProviderRetry(async (attempt) => {
      let response: Response;
      try {
        response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS.anthropic),
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 2048,
            system: [
              'You label speakers in a timed transcript of a seminar or group discussion.',
              'Infer distinct speakers from dialogue cues (questions, answers, names mentioned).',
              'Prefer real names when clearly stated; otherwise use short roles like Host, Participant 1.',
              'Keep labels short (1–3 words). Be consistent across turns.',
              'Respond with JSON only: {"speakers":["Label",...]} with one label per input line, same order/length.',
            ].join(' '),
            messages: [
              {
                role: 'user',
                content: [
                  `Session: ${input.title}`,
                  input.sessionType ? `Type: ${input.sessionType}` : null,
                  'Lines (index|startMs-endMs|text):',
                  numbered,
                ]
                  .filter(Boolean)
                  .join('\n'),
              },
            ],
          }),
        });
      } catch {
        throw new AppError('SPEAKER_LABEL_ERROR', 'Could not reach the Claude API', 502);
      }

      if (!response.ok) {
        logger.warn('Claude speaker labeling failed', {
          status: response.status,
          attempt,
        });
        throw new AppError(
          'SPEAKER_LABEL_ERROR',
          'Claude could not label speakers',
          response.status === 429 ? 429 : 502,
        );
      }

      const payload = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = (payload.content ?? [])
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n')
        .trim();

      if (!text) {
        throw new AppError('SPEAKER_LABEL_ERROR', 'Claude returned empty speaker labels', 502);
      }

      const parsed = extractJson(text) as { speakers?: unknown };
      const names = parsed.speakers;
      if (!Array.isArray(names) || names.length !== slice.length) {
        throw new AppError(
          'SPEAKER_LABEL_ERROR',
          'Claude speaker labels did not match segment count',
          502,
        );
      }

      const labeled = input.segments.map((seg, i) => {
        if (i >= slice.length) return seg;
        const name = names[i];
        const speaker =
          typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : seg.speaker ?? null;
        return { ...seg, speaker };
      });

      return labeled;
    });
  }
}

export class FakeSpeakerLabelProvider implements SpeakerLabelProvider {
  readonly name = 'fake-speakers';

  async label(input: SpeakerLabelInput): Promise<TranscriptionSegment[]> {
    return input.segments.map((seg, i) => ({
      ...seg,
      speaker: i % 2 === 0 ? 'Host' : 'Participant',
    }));
  }
}

export function createSpeakerLabelProvider(): SpeakerLabelProvider | null {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) return null;
  return new ClaudeSpeakerLabelProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || DEFAULT_MODEL);
}

/** Best-effort labeling; falls back to input segments on failure. */
export async function labelSegmentsBestEffort(
  input: SpeakerLabelInput,
  provider: SpeakerLabelProvider | null = createSpeakerLabelProvider(),
): Promise<TranscriptionSegment[]> {
  if (!provider || input.segments.length === 0) return input.segments;
  try {
    return await provider.label(input);
  } catch (err) {
    logger.warn('Speaker labeling skipped; keeping heuristic labels', {
      message: err instanceof Error ? err.message : 'Unknown error',
      provider: provider.name,
    });
    return input.segments;
  }
}
