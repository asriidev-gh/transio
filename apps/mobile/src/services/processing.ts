import type { ProcessAccepted, SessionStatusResponse } from '@sessionai/shared';
import { apiGet, apiRequest } from './api';

export async function startProcessing(sessionId: string): Promise<ProcessAccepted> {
  return apiRequest<ProcessAccepted>(`/sessions/${sessionId}/process`, {
    method: 'POST',
    auth: true,
  });
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
  return apiGet<SessionStatusResponse>(`/sessions/${sessionId}/status`, true);
}
