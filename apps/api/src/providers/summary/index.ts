import { SessionSummarySchema, type SessionSummary } from '@sessionai/shared';
import { getEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../middleware/error-handler.js';
import {
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
  SUMMARY_TOOL,
  SUMMARY_TOOL_NAME,
} from '../../prompts/summary.js';
import type { SummaryInput, SummaryProvider } from './types.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

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
  ) {}

  async summarize(input: SummaryInput): Promise<SessionSummary> {
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
      logger.warn('Claude summary provider returned error', {
        status: response.status,
        provider: this.name,
      });
      throw new AppError('SUMMARY_ERROR', 'Claude summary request failed', 502);
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

  return new ClaudeSummaryProvider(env.ANTHROPIC_API_KEY);
}
