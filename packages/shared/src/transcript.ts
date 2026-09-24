import { z } from 'zod';

/** Timed transcript chunk from Whisper verbose_json (optional speaker label). */
export const TranscriptSegmentSchema = z.object({
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  text: z.string().min(1),
  speaker: z.string().nullable().optional(),
});

export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const TranscriptSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  text: z.string().min(1),
  language: z.string().nullable(),
  segments: z.array(TranscriptSegmentSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Transcript = z.infer<typeof TranscriptSchema>;

export const SessionStatusResponseSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum([
    'recording',
    'uploaded',
    'transcribing',
    'transcribed',
    'summarizing',
    'completed',
    'failed',
  ]),
  hasAudio: z.boolean(),
  hasTranscript: z.boolean(),
  hasSummary: z.boolean(),
  hasNotes: z.boolean().optional().default(false),
});

export type SessionStatusResponse = z.infer<typeof SessionStatusResponseSchema>;

export const TranscribeAcceptedSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.literal('transcribing'),
});

export type TranscribeAccepted = z.infer<typeof TranscribeAcceptedSchema>;

/** Rename speaker labels across all segments of a transcript. */
export const RemapSpeakersSchema = z.object({
  renames: z
    .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(40))
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one rename is required',
    }),
});

export type RemapSpeakersInput = z.infer<typeof RemapSpeakersSchema>;

/** Client-supplied live / edited transcript upsert. */
export const UpsertTranscriptBodySchema = z.object({
  text: z.string().trim().min(1).max(500_000),
  language: z.string().trim().min(2).max(32).nullable().optional(),
  segments: z.array(TranscriptSegmentSchema).max(20_000).optional(),
});

export type UpsertTranscriptBody = z.infer<typeof UpsertTranscriptBodySchema>;
