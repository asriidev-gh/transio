import type {
  RemapSpeakersInput,
  SessionStatusResponse,
  Transcript,
  TranscribeAccepted,
} from '@sessionai/shared';
import { apiGet, apiRequest } from './api';

export async function startTranscription(sessionId: string): Promise<TranscribeAccepted> {
  return apiRequest<TranscribeAccepted>(`/sessions/${sessionId}/transcribe`, {
    method: 'POST',
    auth: true,
  });
}

export async function getTranscript(sessionId: string): Promise<Transcript> {
  return apiGet<Transcript>(`/sessions/${sessionId}/transcript`, true);
}

export async function remapTranscriptSpeakers(
  sessionId: string,
  renames: RemapSpeakersInput['renames'],
): Promise<Transcript> {
  return apiRequest<Transcript>(`/sessions/${sessionId}/transcript/speakers`, {
    method: 'PATCH',
    auth: true,
    body: { renames },
  });
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
  return apiGet<SessionStatusResponse>(`/sessions/${sessionId}/status`, true);
}
