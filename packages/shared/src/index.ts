import { z } from 'zod';

export {
  AuthCredentialsSchema,
  AuthUserSchema,
  type AuthCredentials,
  type AuthUser,
} from './auth.js';

export {
  SessionTypeSchema,
  SessionStatusSchema,
  SessionSchema,
  CreateSessionSchema,
  UpdateSessionSchema,
  SessionIdParamSchema,
  SESSION_TYPE_LABELS,
  SESSION_STATUS_LABELS,
  type SessionType,
  type SessionStatus,
  type Session,
  type CreateSessionInput,
  type UpdateSessionInput,
} from './session.js';

export {
  SESSION_AUDIO_BUCKET,
  AudioUploadResultSchema,
  SignedAudioUrlSchema,
  buildSessionAudioPath,
  extensionFromMimeType,
  type AudioUploadResult,
  type SignedAudioUrl,
} from './storage.js';

export {
  TranscriptSchema,
  SessionStatusResponseSchema,
  TranscribeAcceptedSchema,
  type Transcript,
  type SessionStatusResponse,
  type TranscribeAccepted,
} from './transcript.js';

export {
  SessionSummarySchema,
  SummaryRecordSchema,
  SummarizeAcceptedSchema,
  type SessionSummary,
  type SummaryRecord,
  type SummarizeAccepted,
} from './summary.js';

export {
  ProcessAcceptedSchema,
  PROCESSING_STAGES,
  type ProcessAccepted,
} from './process.js';

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
