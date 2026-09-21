import { z } from 'zod';

export const FeedbackTargetSchema = z.enum(['summary', 'transcript']);
export type FeedbackTarget = z.infer<typeof FeedbackTargetSchema>;

export const FeedbackRatingSchema = z.enum(['up', 'down']);
export type FeedbackRating = z.infer<typeof FeedbackRatingSchema>;

export const SessionFeedbackSchema = z.object({
  summary: FeedbackRatingSchema.nullable(),
  transcript: FeedbackRatingSchema.nullable(),
});

export type SessionFeedback = z.infer<typeof SessionFeedbackSchema>;

export const UpsertFeedbackSchema = z.object({
  target: FeedbackTargetSchema,
  /** Pass null to clear an existing rating. */
  rating: FeedbackRatingSchema.nullable(),
});

export type UpsertFeedbackInput = z.infer<typeof UpsertFeedbackSchema>;
