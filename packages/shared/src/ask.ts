import { z } from 'zod';

export const AskQuestionSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});

export type AskQuestionInput = z.infer<typeof AskQuestionSchema>;

export const AskAnswerSchema = z.object({
  answer: z.string().min(1),
  suggestedFollowUps: z.array(z.string()).default([]),
});

export type AskAnswer = z.infer<typeof AskAnswerSchema>;
