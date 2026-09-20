import { z } from 'zod';

export {
  AuthCredentialsSchema,
  AuthUserSchema,
  type AuthCredentials,
  type AuthUser,
} from './auth.js';

/** Session types supported by SessionAI (Phase 3+ will use these fully). */
export const SessionTypeSchema = z.enum([
  'seminar',
  'group_discussion',
  'bible_study',
  'meeting',
  'lecture',
  'other',
]);

export type SessionType = z.infer<typeof SessionTypeSchema>;

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  seminar: 'Seminar',
  group_discussion: 'Group Discussion',
  bible_study: 'Bible Study',
  meeting: 'Meeting',
  lecture: 'Lecture',
  other: 'Other',
};

/** Processing status for a recorded session. */
export const SessionStatusSchema = z.enum([
  'recording',
  'uploaded',
  'transcribing',
  'transcribed',
  'summarizing',
  'completed',
  'failed',
]);

export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/** Structured AI summary shape (used in Phase 7+). */
export const SessionSummarySchema = z.object({
  overview: z.string(),
  keyPoints: z.array(z.string()),
  topics: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
    }),
  ),
  questionsDiscussed: z.array(z.string()),
  actionItems: z.array(
    z.object({
      task: z.string(),
      details: z.string().optional(),
    }),
  ),
  importantInsights: z.array(z.string()),
  quotes: z.array(z.string()).optional(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

/** Standard API success envelope. */
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

/** Standard API error envelope. */
export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export function apiSuccess<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

export function apiError(
  code: string,
  message: string,
): { success: false; error: { code: string; message: string } } {
  return { success: false, error: { code, message } };
}

/** Health-check payload returned by GET /health. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('sessionai-api'),
  version: z.string(),
  timestamp: z.string(),
  supabaseConfigured: z.boolean(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
