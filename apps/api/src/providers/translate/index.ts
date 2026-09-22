import type {
  TranslatedSummary,
  TranslatedTranscript,
  TranslateLanguage,
  TranslateScope,
  TranscriptSegment,
} from '@sessionai/shared';
import { TranslatedSummarySchema, TranslatedTranscriptSchema } from '@sessionai/shared';
import { getEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { withProviderRetry } from '../../lib/retry.js';
import { AppError } from '../../middleware/error-handler.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
/** Haiku is much faster for translation than Sonnet. */
const DEFAULT_TRANSLATE_MODEL = 'claude-haiku-4-5';
const SEGMENT_CHUNK = 45;
const CHUNK_CONCURRENCY = 4;
/** Prefer one request when the transcript is small enough. */
const SINGLE_SHOT_MAX_SEGMENTS = 50;
const SINGLE_SHOT_MAX_CHARS = 14_000;

export interface TranslateSummaryInput {
  language: TranslateLanguage;
  languageLabel: string;
  summary: TranslatedSummary;
}

export interface TranslateTranscriptInput {
  language: TranslateLanguage;
  languageLabel: string;
  text: string;
  segments: TranscriptSegment[];
}

export interface TranslateChunkInput {
  language: TranslateLanguage;
  languageLabel: string;
  text: string;
  sourceLanguageLabel?: string;
}

export interface TranslateProvider {
  readonly name: string;
  translateSummary(input: TranslateSummaryInput): Promise<TranslatedSummary>;
  translateTranscript(input: TranslateTranscriptInput): Promise<TranslatedTranscript>;
  translateChunk(input: TranslateChunkInput): Promise<string>;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate) as unknown;
}

function languageInstruction(label: string): string {
  return [
    `Translate into ${label}.`,
    'Preserve meaning. Keep proper nouns when natural.',
    'JSON only — no markdown.',
  ].join(' ');
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!, index);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

async function callClaude(input: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  return withProviderRetry(async (attempt) => {
    let response: Response;
    try {
      response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': input.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: input.model,
          max_tokens: input.maxTokens,
          temperature: 0,
          system: input.system,
          messages: [{ role: 'user', content: input.user }],
        }),
      });
    } catch {
      throw new AppError('TRANSLATE_ERROR', 'Could not reach the Claude API', 502);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const errBody = (await response.json()) as { error?: { message?: string } };
        detail = errBody.error?.message ?? '';
      } catch {
        // ignore
      }
      logger.warn('Claude translate provider returned error', {
        status: response.status,
        detail: detail || undefined,
        attempt,
        model: input.model,
      });
      if (response.status === 429) {
        throw new AppError(
          'TRANSLATE_ERROR',
          'Claude is rate-limited. Please retry shortly.',
          429,
        );
      }
      throw new AppError(
        'TRANSLATE_ERROR',
        detail || 'Claude could not translate this content.',
        response.status >= 500 ? 502 : 400,
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
      throw new AppError('TRANSLATE_ERROR', 'Claude returned an empty translation.', 502);
    }
    return text;
  });
}

function prefixText(language: TranslateLanguage, text: string): string {
  return `[${language}] ${text}`;
}

function mergeTranslatedTexts(
  originals: TranscriptSegment[],
  texts: string[],
): TranscriptSegment[] {
  return originals.map((original, index) => {
    const next = texts[index];
    return {
      startMs: original.startMs,
      endMs: original.endMs,
      text: typeof next === 'string' && next.trim() ? next.trim() : original.text,
      speaker: original.speaker ?? null,
    };
  });
}

export class ClaudeTranslateProvider implements TranslateProvider {
  readonly name = 'claude-translate';

  constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_TRANSLATE_MODEL,
  ) {}

  async translateSummary(input: TranslateSummaryInput): Promise<TranslatedSummary> {
    const system = [
      languageInstruction(input.languageLabel),
      'Return the same JSON keys with translated string values:',
      'overview, keyPoints, topics[{title,summary}], questionsDiscussed,',
      'actionItems[{task,details?}], importantInsights, quotes.',
    ].join(' ');

    const raw = await callClaude({
      apiKey: this.apiKey,
      model: this.model,
      system,
      user: JSON.stringify(input.summary),
      maxTokens: 3072,
    });

    try {
      return TranslatedSummarySchema.parse(extractJson(raw));
    } catch {
      throw new AppError('TRANSLATE_ERROR', 'Claude returned an invalid summary translation.', 502);
    }
  }

  async translateChunk(input: TranslateChunkInput): Promise<string> {
    const sourceHint = input.sourceLanguageLabel
      ? ` Source language: ${input.sourceLanguageLabel}.`
      : '';
    const system = [
      `You are a speech-caption translator.`,
      `Translate the user message into ${input.languageLabel}.${sourceHint}`,
      `Reply with ONLY the translated caption text.`,
      `Do not explain, greet, ask questions, or wrap the answer in quotes.`,
      `If the input is already in ${input.languageLabel}, return it unchanged.`,
    ].join(' ');

    const raw = await callClaude({
      apiKey: this.apiKey,
      model: this.model,
      system,
      user: input.text,
      maxTokens: Math.min(1024, Math.max(128, input.text.length * 3)),
    });

    const text = raw
      .trim()
      .replace(/^["'«»]+|["'«»]+$/g, '')
      .trim();
    if (!text) {
      throw new AppError('TRANSLATE_ERROR', 'Claude returned an empty live translation.', 502);
    }
    // Guard against chatty model replies that aren't a caption translation.
    if (
      text.length > Math.max(120, input.text.length * 8) ||
      /i'?m ready|please share|however,? i don'?t|i can help translate/i.test(text)
    ) {
      throw new AppError(
        'TRANSLATE_ERROR',
        'Live translation returned an invalid response. Try again.',
        502,
      );
    }
    return text;
  }

  private async translateTextBatch(
    languageLabel: string,
    texts: string[],
  ): Promise<string[]> {
    const system = [
      languageInstruction(languageLabel),
      'Input: {"texts":["..."]}.',
      'Output: {"texts":["..."]} with the same length and order.',
      'Translate each string. Keep empty strings empty.',
    ].join(' ');

    const raw = await callClaude({
      apiKey: this.apiKey,
      model: this.model,
      system,
      user: JSON.stringify({ texts }),
      maxTokens: Math.min(8192, Math.max(1024, texts.join('').length + texts.length * 24)),
    });

    let parsed: { texts?: unknown };
    try {
      parsed = extractJson(raw) as { texts?: unknown };
    } catch {
      throw new AppError(
        'TRANSLATE_ERROR',
        'Claude returned an invalid transcript translation.',
        502,
      );
    }

    if (!Array.isArray(parsed.texts) || parsed.texts.length !== texts.length) {
      throw new AppError(
        'TRANSLATE_ERROR',
        'Claude returned a mismatched transcript segment count.',
        502,
      );
    }

    return parsed.texts.map((value, index) =>
      typeof value === 'string' && value.trim() ? value.trim() : texts[index]!,
    );
  }

  async translateTranscript(input: TranslateTranscriptInput): Promise<TranslatedTranscript> {
    if (input.segments.length > 0) {
      const totalChars = input.segments.reduce((sum, s) => sum + s.text.length, 0);
      const useSingleShot =
        input.segments.length <= SINGLE_SHOT_MAX_SEGMENTS &&
        totalChars <= SINGLE_SHOT_MAX_CHARS;

      let translatedTexts: string[];

      if (useSingleShot) {
        translatedTexts = await this.translateTextBatch(
          input.languageLabel,
          input.segments.map((s) => s.text),
        );
      } else {
        const chunks: string[][] = [];
        for (let i = 0; i < input.segments.length; i += SEGMENT_CHUNK) {
          chunks.push(input.segments.slice(i, i + SEGMENT_CHUNK).map((s) => s.text));
        }

        const chunkResults = await mapPool(chunks, CHUNK_CONCURRENCY, (chunk) =>
          this.translateTextBatch(input.languageLabel, chunk),
        );
        translatedTexts = chunkResults.flat();
      }

      const translatedSegments = mergeTranslatedTexts(input.segments, translatedTexts);
      const text = translatedSegments.map((s) => s.text).join('\n');
      return TranslatedTranscriptSchema.parse({ text, segments: translatedSegments });
    }

    const system = [
      languageInstruction(input.languageLabel),
      'Return JSON: {"text":"..."}',
    ].join(' ');

    const raw = await callClaude({
      apiKey: this.apiKey,
      model: this.model,
      system,
      user: JSON.stringify({ text: input.text.slice(0, 80_000) }),
      maxTokens: 8192,
    });

    try {
      const parsed = extractJson(raw) as { text?: string };
      const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      if (!text) {
        throw new Error('missing text');
      }
      return TranslatedTranscriptSchema.parse({ text, segments: [] });
    } catch {
      throw new AppError(
        'TRANSLATE_ERROR',
        'Claude returned an invalid transcript translation.',
        502,
      );
    }
  }
}

export class FakeTranslateProvider implements TranslateProvider {
  readonly name = 'fake-translate';

  async translateSummary(input: TranslateSummaryInput): Promise<TranslatedSummary> {
    const tag = (value: string) => prefixText(input.language, value);
    return {
      overview: input.summary.overview ? tag(input.summary.overview) : '',
      keyPoints: input.summary.keyPoints.map(tag),
      topics: input.summary.topics.map((t: { title: string; summary: string }) => ({
        title: tag(t.title),
        summary: tag(t.summary),
      })),
      questionsDiscussed: input.summary.questionsDiscussed.map(tag),
      actionItems: input.summary.actionItems.map(
        (a: { task: string; details?: string }) => ({
          task: tag(a.task),
          details: a.details ? tag(a.details) : undefined,
        }),
      ),
      importantInsights: input.summary.importantInsights.map(tag),
      quotes: (input.summary.quotes ?? []).map(tag),
    };
  }

  async translateTranscript(input: TranslateTranscriptInput): Promise<TranslatedTranscript> {
    if (input.segments.length > 0) {
      const segments = input.segments.map((s) => ({
        ...s,
        text: prefixText(input.language, s.text),
      }));
      return {
        text: segments.map((s) => s.text).join('\n'),
        segments,
      };
    }
    return {
      text: prefixText(input.language, input.text),
      segments: [],
    };
  }

  async translateChunk(input: TranslateChunkInput): Promise<string> {
    return prefixText(input.language, input.text);
  }
}

export function createTranslateProvider(): TranslateProvider {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(
      'CONFIG_ERROR',
      'Translate is not configured. Set ANTHROPIC_API_KEY on the API.',
      503,
    );
  }
  const model =
    env.ANTHROPIC_TRANSLATE_MODEL.trim() ||
    DEFAULT_TRANSLATE_MODEL;
  return new ClaudeTranslateProvider(env.ANTHROPIC_API_KEY, model);
}

export type { TranslateScope };
