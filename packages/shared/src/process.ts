import { z } from 'zod';

export const ProcessAcceptedSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(['transcribing', 'summarizing', 'completed']),
  stage: z.enum(['transcribe', 'summarize', 'done']),
});

export type ProcessAccepted = z.infer<typeof ProcessAcceptedSchema>;

/** Human-readable pipeline stages for the Processing screen. */
export const PROCESSING_STAGES = [
  { key: 'uploaded', label: 'Uploaded' },
  { key: 'transcribing', label: 'Transcribing' },
  { key: 'transcribed', label: 'Transcript saved' },
  { key: 'summarizing', label: 'Generating summary' },
  { key: 'completed', label: 'Completed' },
] as const;
