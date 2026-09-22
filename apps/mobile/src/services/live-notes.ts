import type { LiveNotesChunkResult, SessionSummary } from '@sessionai/shared';
import { apiRequest } from './api';

export async function mergeLiveNotesChunk(
  sessionId: string,
  text: string,
  previousNotes?: Partial<SessionSummary>,
): Promise<LiveNotesChunkResult> {
  return apiRequest<LiveNotesChunkResult>(`/sessions/${sessionId}/notes-live`, {
    method: 'POST',
    auth: true,
    body: {
      text,
      ...(previousNotes ? { previousNotes } : {}),
    },
    retries: 1,
  });
}

export async function finalizeSessionNotes(
  sessionId: string,
  notes: SessionSummary,
): Promise<void> {
  await apiRequest(`/sessions/${sessionId}/notes/finalize`, {
    method: 'POST',
    auth: true,
    body: notes,
    retries: 1,
  });
}
