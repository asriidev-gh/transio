import type { CreateSessionInput, Session, UpdateSessionInput } from '@sessionai/shared';
import { apiGet, apiRequest } from './api';

export async function listSessions(): Promise<Session[]> {
  return apiGet<Session[]>('/sessions', true);
}

export async function getSession(id: string): Promise<Session> {
  return apiGet<Session>(`/sessions/${id}`, true);
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  return apiRequest<Session>('/sessions', {
    method: 'POST',
    body: input,
    auth: true,
  });
}

export async function updateSession(id: string, input: UpdateSessionInput): Promise<Session> {
  return apiRequest<Session>(`/sessions/${id}`, {
    method: 'PATCH',
    body: input,
    auth: true,
  });
}

export async function deleteSession(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/sessions/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}
