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
  CaptureModeSchema,
  AudioStorageSchema,
  SessionSchema,
  CreateSessionSchema,
  UpdateSessionSchema,
  SessionIdParamSchema,
  SESSION_TYPE_LABELS,
  SESSION_STATUS_LABELS,
  CAPTURE_MODE_LABELS,
  CAPTURE_MODE_SHORT_LABELS,
  isNotesOnlyCaptureMode,
  type SessionType,
  type SessionStatus,
  type CaptureMode,
  type AudioStorage,
  type Session,
  type CreateSessionInput,
  type UpdateSessionInput,
} from './session.js';

export {
  SessionFolderSchema,
  CreateFolderSchema,
  UpdateFolderSchema,
  FolderIdParamSchema,
  type SessionFolder,
  type CreateFolderInput,
  type UpdateFolderInput,
} from './folder.js';

export {
  SESSION_AUDIO_BUCKET,
  AudioUploadResultSchema,
  SignedAudioUrlSchema,
  ImportMediaUrlSchema,
  buildSessionAudioPath,
  extensionFromMimeType,
  type AudioUploadResult,
  type SignedAudioUrl,
  type ImportMediaUrlInput,
} from './storage.js';

export {
  TranscriptSegmentSchema,
  TranscriptSchema,
  SessionStatusResponseSchema,
  TranscribeAcceptedSchema,
  RemapSpeakersSchema,
  UpsertTranscriptBodySchema,
  type TranscriptSegment,
  type Transcript,
  type SessionStatusResponse,
  type TranscribeAccepted,
  type RemapSpeakersInput,
  type UpsertTranscriptBody,
} from './transcript.js';

export {
  SessionSummarySchema,
  SummaryRecordSchema,
  SummaryKindSchema,
  SummarizeAcceptedSchema,
  LiveNotesChunkRequestSchema,
  LiveNotesChunkResultSchema,
  FinalizeNotesRequestSchema,
  type SessionSummary,
  type SummaryRecord,
  type SummaryKind,
  type SummarizeAccepted,
  type LiveNotesChunkRequest,
  type LiveNotesChunkResult,
  type FinalizeNotesRequest,
} from './summary.js';

export {
  splitIntoSentences,
  bulletsFromCaptionFinals,
  rawNotesFromText,
  rawNotesFromFinals,
  bulletsFromNotes,
} from './sentences.js';

export {
  MindMapNodeKindSchema,
  MindMapNodeSchema,
  MindMapSchema,
  deriveMindMapFromSummary,
  type MindMap,
  type MindMapNode,
  type MindMapNodeKind,
  type MindMapSummaryInput,
} from './mind-map.js';

export {
  ProcessAcceptedSchema,
  PROCESSING_STAGES,
  type ProcessAccepted,
} from './process.js';

export {
  AskQuestionSchema,
  AskAnswerSchema,
  type AskQuestionInput,
  type AskAnswer,
} from './ask.js';

export {
  TranslateLanguageSchema,
  TranslateScopeSchema,
  TranslateRequestSchema,
  TranslatedSummarySchema,
  TranslatedTranscriptSchema,
  TranslateResultSchema,
  LiveTranslateChunkRequestSchema,
  LiveTranslateChunkResultSchema,
  VoiceTranslateResultSchema,
  TRANSLATE_LANGUAGE_LABELS,
  TRANSLATE_LANGUAGE_OPTIONS,
  type TranslateLanguage,
  type TranslateScope,
  type TranslateRequest,
  type TranslatedSummary,
  type TranslatedTranscript,
  type TranslateResult,
  type LiveTranslateChunkRequest,
  type LiveTranslateChunkResult,
  type VoiceTranslateResult,
} from './translate.js';

export {
  FeedbackTargetSchema,
  FeedbackRatingSchema,
  SessionFeedbackSchema,
  UpsertFeedbackSchema,
  type FeedbackTarget,
  type FeedbackRating,
  type SessionFeedback,
  type UpsertFeedbackInput,
} from './feedback.js';

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
