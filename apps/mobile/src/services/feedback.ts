import type {
  FeedbackRating,
  FeedbackTarget,
  SessionFeedback,
} from '@sessionai/shared';
import { apiGet, apiRequest } from './api';

export async function getSessionFeedback(sessionId: string): Promise<SessionFeedback> {
  return apiGet<SessionFeedback>(`/sessions/${sessionId}/feedback`, true);
}

export async function setSessionFeedback(
  sessionId: string,
  target: FeedbackTarget,
  rating: FeedbackRating | null,
): Promise<SessionFeedback> {
  return apiRequest<SessionFeedback>(`/sessions/${sessionId}/feedback`, {
    method: 'PUT',
    auth: true,
    body: { target, rating },
  });
}
