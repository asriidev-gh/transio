import { z } from 'zod';

export const ProcessAcceptedSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(['transcribing', 'transcribed', 'summarizing', 'completed']),
  stage: z.enum(['transcribe', 'summarize', 'done']),
});

export type ProcessAccepted = z.infer<typeof ProcessAcceptedSchema>;

/** Human-readable pipeline stages for the Processing screen. */
export const PROCESSING_STAGES = [
  { key: 'uploaded', label: 'Uploaded' },
  { key: 'transcribing', label: 'Transcribing' },
  { key: 'transcribed', label: 'Transcript + speakers' },
  { key: 'summarizing', label: 'Summarizing' },
  { key: 'completed', label: 'Finishing up' },
] as const;
