import type { SessionType } from '@sessionai/shared';

const BASE_INSTRUCTIONS = `You are SessionAI, an expert note-taker for recorded conversations.
Read the transcript and produce a structured summary.
Be faithful to the source: do not invent facts, speakers, or action items that are not supported by the transcript.
Prefer concise, concrete language. Empty arrays are allowed when a section truly has nothing relevant.
Return only the structured summary via the provided tool.`;

const TYPE_FOCUS: Record<SessionType, string> = {
  seminar:
    'Emphasize the teaching arc, core arguments, supporting examples, and takeaways participants should remember.',
  group_discussion:
    'Emphasize viewpoints shared, points of agreement/disagreement, open questions, and any agreed next steps.',
  bible_study:
    'Emphasize passages or themes discussed, interpretive insights, application points, and lingering questions. Do not invent scripture references.',
  meeting:
    'Emphasize decisions, owners, deadlines, blockers, and clear action items. Keep the overview short and operational.',
  lecture:
    'Emphasize the lecture outline, key concepts explained, definitions, and study-worthy points.',
  other:
    'Capture the main purpose of the conversation, notable points, questions, and any follow-ups.',
};

export function buildSummarySystemPrompt(sessionType: SessionType): string {
  return `${BASE_INSTRUCTIONS}\n\nSession type: ${sessionType}.\nFocus: ${TYPE_FOCUS[sessionType]}`;
}

export function buildSummaryUserPrompt(input: {
  transcriptText: string;
  sessionType: SessionType;
  title?: string;
}): string {
  const titleLine = input.title?.trim() ? `Title: ${input.title.trim()}\n` : '';
  return `${titleLine}Session type: ${input.sessionType}

Transcript:
"""
${input.transcriptText}
"""`;
}

/** Anthropic tool schema matching SessionSummary (Zod-validated after parse). */
export const SUMMARY_TOOL_NAME = 'save_session_summary';

export const SUMMARY_TOOL = {
  name: SUMMARY_TOOL_NAME,
  description: 'Save the structured session summary derived from the transcript.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'overview',
      'keyPoints',
      'topics',
      'questionsDiscussed',
      'actionItems',
      'importantInsights',
    ],
    properties: {
      overview: {
        type: 'string',
        description: 'One short paragraph overview of the session.',
      },
      keyPoints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Bullet-level key points.',
      },
      topics: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'summary'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
          },
        },
      },
      questionsDiscussed: {
        type: 'array',
        items: { type: 'string' },
      },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['task'],
          properties: {
            task: { type: 'string' },
            details: { type: 'string' },
          },
        },
      },
      importantInsights: {
        type: 'array',
        items: { type: 'string' },
      },
      quotes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional memorable quotes from the transcript.',
      },
    },
  },
} as const;
