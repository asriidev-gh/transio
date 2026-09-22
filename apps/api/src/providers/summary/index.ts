import { SessionSummarySchema, type SessionSummary } from '@sessionai/shared';
import { getEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { withProviderRetry } from '../../lib/retry.js';
import { AppError } from '../../middleware/error-handler.js';
import {
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
  SUMMARY_TOOL,
  SUMMARY_TOOL_NAME,
} from '../../prompts/summary.js';
import type { LiveNotesMergeInput, SummaryInput, SummaryProvider } from './types.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-5';
const DEFAULT_LIVE_NOTES_MODEL = 'claude-haiku-4-5';

interface AnthropicContentBlock {
  type: string;
  name?: string;
  input?: unknown;
  text?: string;
}

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
}

/**
 * Claude Messages API summary provider using tool_use for structured JSON.
 * Configure with ANTHROPIC_API_KEY (server-only).
 */
export class ClaudeSummaryProvider implements SummaryProvider {
  readonly name = 'claude';

  constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_MODEL,
    private readonly liveNotesModel = DEFAULT_LIVE_NOTES_MODEL,
  ) {}

  async summarize(input: SummaryInput): Promise<SessionSummary> {
    return withProviderRetry(async (attempt) => {
      const body = {
        model: this.model,
        max_tokens: 4096,
        system: buildSummarySystemPrompt(input.sessionType),
        tools: [SUMMARY_TOOL],
        tool_choice: { type: 'tool', name: SUMMARY_TOOL_NAME },
        messages: [
          {
            role: 'user',
            content: buildSummaryUserPrompt({
              transcriptText: input.transcriptText,
              sessionType: input.sessionType,
              title: input.title,
            }),
          },
        ],
      };

      let response: Response;
      try {
        response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });
      } catch {
        throw new AppError('SUMMARY_ERROR', 'Could not reach the Claude API', 502);
      }

      if (!response.ok) {
        let detail = '';
        try {
          const errBody = (await response.json()) as {
            error?: { message?: string; type?: string };
          };
          detail = errBody.error?.message ?? '';
        } catch {
          // ignore parse failures
        }
        logger.warn('Claude summary provider returned error', {
          status: response.status,
          provider: this.name,
          model: this.model,
          detail: detail || undefined,
          attempt,
        });
        if (response.status === 429) {
          throw new AppError(
            'SUMMARY_ERROR',
            detail
              ? `Claude is rate-limited (${detail})`
              : 'Claude is rate-limited. Please retry in a moment.',
            429,
          );
        }
        if (response.status === 404) {
          throw new AppError(
            'SUMMARY_ERROR',
            detail
              ? `Claude summary request failed (${detail})`
              : 'Claude summary request failed',
            502,
          );
        }
        throw new AppError(
          'SUMMARY_ERROR',
          detail
            ? `Claude summary request failed (${detail})`
            : 'Claude summary request failed',
          response.status >= 500 ? 502 : 502,
        );
      }

      const payload = (await response.json()) as AnthropicMessagesResponse;
      const toolBlock = payload.content?.find(
        (block) => block.type === 'tool_use' && block.name === SUMMARY_TOOL_NAME,
      );

      if (!toolBlock?.input) {
        throw new AppError('SUMMARY_ERROR', 'Claude did not return a structured summary', 502);
      }

      const parsed = SessionSummarySchema.safeParse(toolBlock.input);
      if (!parsed.success) {
        logger.warn('Claude summary failed Zod validation', {
          provider: this.name,
          issueCount: parsed.error.issues.length,
        });
        throw new AppError('SUMMARY_ERROR', 'Claude summary failed schema validation', 502);
      }

      return parsed.data;
    });
  }

  async mergeLiveNotes(input: LiveNotesMergeInput): Promise<SessionSummary> {
    return withProviderRetry(async (attempt) => {
      const previous = input.previousNotes
        ? JSON.stringify(input.previousNotes)
        : '{}';
      const system = [
        'You maintain live meeting notes while someone is still speaking.',
        'Merge the new speech into previous notes. Stay concise and factual.',
        'Do not invent facts. Empty arrays are fine.',
        'Return the full updated notes object via the tool.',
      ].join(' ');

      const body = {
        model: this.liveNotesModel,
        max_tokens: 1024,
        system,
        tools: [SUMMARY_TOOL],
        tool_choice: { type: 'tool', name: SUMMARY_TOOL_NAME },
        messages: [
          {
            role: 'user',
            content: `${input.title?.trim() ? `Title: ${input.title.trim()}\n` : ''}Type: ${input.sessionType}

Previous notes:
${previous}

New speech:
${input.text}`,
          },
        ],
      };

      let response: Response;
      try {
        response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });
      } catch {
        throw new AppError('SUMMARY_ERROR', 'Could not reach the Claude API', 502);
      }

      if (!response.ok) {
        let detail = '';
        try {
          const errBody = (await response.json()) as {
            error?: { message?: string };
          };
          detail = errBody.error?.message ?? '';
        } catch {
          // ignore
        }
        logger.warn('Claude live-notes merge returned error', {
          status: response.status,
          provider: this.name,
          model: this.liveNotesModel,
          detail: detail || undefined,
          attempt,
        });
        throw new AppError(
          'SUMMARY_ERROR',
          detail ? `Live notes update failed (${detail})` : 'Live notes update failed',
          response.status === 429 ? 429 : 502,
        );
      }

      const payload = (await response.json()) as AnthropicMessagesResponse;
      const toolBlock = payload.content?.find(
        (block) => block.type === 'tool_use' && block.name === SUMMARY_TOOL_NAME,
      );

      if (!toolBlock?.input) {
        throw new AppError('SUMMARY_ERROR', 'Claude did not return updated notes', 502);
      }

      const parsed = SessionSummarySchema.safeParse(toolBlock.input);
      if (!parsed.success) {
        throw new AppError('SUMMARY_ERROR', 'Live notes failed schema validation', 502);
      }

      return parsed.data;
    });
  }
}

/** Test-only provider with deterministic structured output. */
export class FakeSummaryProvider implements SummaryProvider {
  readonly name = 'fake';

  constructor(private readonly summary?: SessionSummary) {}

  async summarize(input: SummaryInput): Promise<SessionSummary> {
    if (this.summary) return this.summary;
    return {
      overview: `Summary of ${input.sessionType} session.`,
      keyPoints: ['First key point', 'Second key point'],
      topics: [{ title: 'Main topic', summary: 'A short topic summary.' }],
      questionsDiscussed: ['What should we do next?'],
      actionItems: [{ task: 'Follow up with the group', details: 'Send notes by Friday' }],
      importantInsights: ['Clarity beats volume.'],
      quotes: ['This is a memorable line from the transcript.'],
    };
  }

  async mergeLiveNotes(input: LiveNotesMergeInput): Promise<SessionSummary> {
    const base = await this.summarize({
      transcriptText: input.text,
      sessionType: input.sessionType,
      title: input.title,
    });
    const prevPoints = input.previousNotes?.keyPoints ?? [];
    return {
      ...base,
      overview: input.previousNotes?.overview?.trim()
        ? `${input.previousNotes.overview} ${input.text}`.trim()
        : base.overview,
      keyPoints: [...prevPoints, ...base.keyPoints].slice(0, 12),
    };
  }
}

export function createSummaryProvider(): SummaryProvider {
  const env = getEnv();

  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'Summarization is not configured. Set ANTHROPIC_API_KEY on the API.',
      503,
    );
  }

  return new ClaudeSummaryProvider(
    env.ANTHROPIC_API_KEY,
    env.ANTHROPIC_MODEL.trim() || DEFAULT_MODEL,
    env.ANTHROPIC_TRANSLATE_MODEL.trim() || DEFAULT_LIVE_NOTES_MODEL,
  );
}
