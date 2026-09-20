import type {
  SessionStatusResponse,
  SummarizeAccepted,
  SummaryRecord,
} from '@sessionai/shared';
import { apiGet, apiRequest } from './api';

export async function startSummarization(sessionId: string): Promise<SummarizeAccepted> {
  return apiRequest<SummarizeAccepted>(`/sessions/${sessionId}/summarize`, {
    method: 'POST',
    auth: true,
  });
}

export async function getSummary(sessionId: string): Promise<SummaryRecord> {
  return apiGet<SummaryRecord>(`/sessions/${sessionId}/summary`, true);
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
  return apiGet<SessionStatusResponse>(`/sessions/${sessionId}/status`, true);
}
