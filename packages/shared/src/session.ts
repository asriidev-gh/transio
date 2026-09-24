import { z } from 'zod';

/** Session types supported by SessionAI. */
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

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  recording: 'Recording',
  uploaded: 'Uploaded',
  transcribing: 'Transcribing',
  transcribed: 'Transcribed',
  summarizing: 'Generating summary',
  completed: 'Completed',
  failed: 'Failed',
};

/** How speech was captured for this session. */
export const CaptureModeSchema = z.enum(['live', 'batch', 'notes', 'live_notes']);
export type CaptureMode = z.infer<typeof CaptureModeSchema>;

export const CAPTURE_MODE_LABELS: Record<CaptureMode, string> = {
  live: 'Live captions',
  batch: 'Record Audio and Transcribe',
  notes: 'Transcribe Audio/Video File',
  live_notes: 'Live Note Taker',
};

/** Compact labels for list pills / chips. */
export const CAPTURE_MODE_SHORT_LABELS: Record<CaptureMode, string> = {
  live: 'Live captions',
  batch: 'Recording',
  notes: 'File',
  live_notes: 'Live Notes',
};

export function isNotesOnlyCaptureMode(mode: CaptureMode): boolean {
  return mode === 'notes' || mode === 'live_notes';
}

/** Session row as returned by the API (camelCase). */
export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  sessionType: SessionTypeSchema,
  description: z.string().nullable(),
  recordedAt: z.string(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  audioPath: z.string().nullable(),
  status: SessionStatusSchema,
  captureMode: CaptureModeSchema.default('batch'),
  favoritedAt: z.string().nullable().default(null),
  folderId: z.string().uuid().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or fewer'),
  sessionType: SessionTypeSchema,
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional()
    .nullable(),
  recordedAt: z.string().datetime().optional(),
  folderId: z.string().uuid().optional(),
  captureMode: CaptureModeSchema.optional().default('batch'),
});

export type CreateSessionInput = z.input<typeof CreateSessionSchema>;

export const UpdateSessionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(200, 'Title must be 200 characters or fewer')
      .optional(),
    sessionType: SessionTypeSchema.optional(),
    description: z
      .string()
      .trim()
      .max(2000, 'Description must be 2000 characters or fewer')
      .nullable()
      .optional(),
    recordedAt: z.string().datetime().optional(),
    durationSeconds: z.number().int().nonnegative().nullable().optional(),
    audioPath: z.string().min(1).nullable().optional(),
    status: SessionStatusSchema.optional(),
    captureMode: CaptureModeSchema.optional(),
    /** ISO timestamp to favorite; null to unfavorite. */
    favoritedAt: z.string().datetime().nullable().optional(),
    /** Folder id to file the session; null to move back to Unfiled. */
    folderId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

export const SessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session id'),
});
