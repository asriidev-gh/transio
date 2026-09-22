import { z } from 'zod';

/** Structured AI summary shape produced by Claude and stored in `summaries`. */
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

export const SummaryRecordSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  overview: z.string().nullable(),
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
  quotes: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SummaryRecord = z.infer<typeof SummaryRecordSchema>;

export const SummarizeAcceptedSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.literal('summarizing'),
});

export type SummarizeAccepted = z.infer<typeof SummarizeAcceptedSchema>;

/** Incremental live note-taker merge (during recording). */
export const LiveNotesChunkRequestSchema = z.object({
  text: z.string().trim().min(1).max(4_000),
  previousNotes: SessionSummarySchema.partial().optional(),
});

export type LiveNotesChunkRequest = z.infer<typeof LiveNotesChunkRequestSchema>;

export const LiveNotesChunkResultSchema = SessionSummarySchema;

export type LiveNotesChunkResult = z.infer<typeof LiveNotesChunkResultSchema>;

/** Persist final notes for notes-only sessions (no transcript). */
export const FinalizeNotesRequestSchema = SessionSummarySchema;

export type FinalizeNotesRequest = z.infer<typeof FinalizeNotesRequestSchema>;
