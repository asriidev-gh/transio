import { getEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { withProviderRetry } from '../../lib/retry.js';
import { AppError } from '../../middleware/error-handler.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-5';

export interface AskInput {
  question: string;
  title: string;
  sessionType: string;
  transcriptText: string;
  summaryContext?: string;
}

export interface AskResult {
  answer: string;
  suggestedFollowUps: string[];
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[];
}

export interface AskProvider {
  readonly name: string;
  ask(input: AskInput): Promise<AskResult>;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate) as unknown;
}

export class ClaudeAskProvider implements AskProvider {
  readonly name = 'claude-ask';

  constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_MODEL,
  ) {}

  async ask(input: AskInput): Promise<AskResult> {
    return withProviderRetry(async (attempt) => {
      const system = [
        'You answer questions about a recorded seminar or group discussion.',
        'Use only the provided transcript and summary. If the answer is not in the source, say so.',
        'Be concise and concrete. Prefer short paragraphs or bullets.',
        'Respond with JSON only: {"answer":"...","suggestedFollowUps":["...","..."]}',
        'suggestedFollowUps must be 0–3 short follow-up questions grounded in the source.',
      ].join(' ');

      const user = [
        `Session title: ${input.title}`,
        `Session type: ${input.sessionType}`,
        input.summaryContext ? `Summary:\n${input.summaryContext}` : null,
        `Transcript:\n${input.transcriptText.slice(0, 120_000)}`,
        `Question: ${input.question}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      let response: Response;
      try {
        response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 1024,
            system,
            messages: [{ role: 'user', content: user }],
          }),
        });
      } catch {
        throw new AppError('ASK_ERROR', 'Could not reach the Claude API', 502);
      }

      if (!response.ok) {
        let detail = '';
        try {
          const errBody = (await response.json()) as { error?: { message?: string } };
          detail = errBody.error?.message ?? '';
        } catch {
          // ignore
        }
        logger.warn('Claude ask provider returned error', {
          status: response.status,
          detail: detail || undefined,
          attempt,
        });
        if (response.status === 429) {
          throw new AppError('ASK_ERROR', 'Claude is rate-limited. Please retry shortly.', 429);
        }
        throw new AppError(
          'ASK_ERROR',
          detail || 'Claude could not answer this question.',
          response.status >= 500 ? 502 : 400,
        );
      }

      const payload = (await response.json()) as AnthropicMessagesResponse;
      const text = (payload.content ?? [])
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n')
        .trim();

      if (!text) {
        throw new AppError('ASK_ERROR', 'Claude returned an empty answer.', 502);
      }

      try {
        const parsed = extractJsonObject(text) as {
          answer?: string;
          suggestedFollowUps?: string[];
        };
        const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
        if (!answer) {
          throw new Error('missing answer');
        }
        const followUps = Array.isArray(parsed.suggestedFollowUps)
          ? parsed.suggestedFollowUps.filter((s): s is string => typeof s === 'string').slice(0, 3)
          : [];
        return { answer, suggestedFollowUps: followUps };
      } catch {
        return { answer: text, suggestedFollowUps: [] };
      }
    });
  }
}

export class FakeAskProvider implements AskProvider {
  readonly name = 'fake-ask';

  async ask(input: AskInput): Promise<AskResult> {
    return {
      answer: `Based on “${input.title}”: ${input.question.trim()} — key points are covered in the transcript.`,
      suggestedFollowUps: ['What were the action items?', 'Who spoke about next steps?'],
    };
  }
}

export function createAskProvider(): AskProvider {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(
      'CONFIG_ERROR',
      'Ask is not configured. Set ANTHROPIC_API_KEY on the API.',
      503,
    );
  }
  return new ClaudeAskProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || DEFAULT_MODEL);
}
