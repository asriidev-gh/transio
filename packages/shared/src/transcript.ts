import { z } from 'zod';

export const TranscriptSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  text: z.string().min(1),
  language: z.string().nullable(),
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
});

export type SessionStatusResponse = z.infer<typeof SessionStatusResponseSchema>;

export const TranscribeAcceptedSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.literal('transcribing'),
});

export type TranscribeAccepted = z.infer<typeof TranscribeAcceptedSchema>;
