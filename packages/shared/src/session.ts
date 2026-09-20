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
  favoritedAt: z.string().nullable().default(null),
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
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

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
    /** ISO timestamp to favorite; null to unfavorite. */
    favoritedAt: z.string().datetime().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

export const SessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session id'),
});
