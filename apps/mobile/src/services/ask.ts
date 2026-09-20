import type { AskAnswer } from '@sessionai/shared';
import { apiRequest } from './api';

export async function askSessionQuestion(
  sessionId: string,
  question: string,
): Promise<AskAnswer> {
  return apiRequest<AskAnswer>(`/sessions/${sessionId}/ask`, {
    method: 'POST',
    auth: true,
    body: { question },
  });
}
