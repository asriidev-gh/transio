import type {
  CreateFolderInput,
  SessionFolder,
  UpdateFolderInput,
} from '@sessionai/shared';
import { apiGet, apiRequest } from './api';

export async function listFolders(): Promise<SessionFolder[]> {
  return apiGet<SessionFolder[]>('/folders', true);
}

export async function getFolder(id: string): Promise<SessionFolder> {
  return apiGet<SessionFolder>(`/folders/${id}`, true);
}

export async function createFolder(input: CreateFolderInput): Promise<SessionFolder> {
  return apiRequest<SessionFolder>('/folders', {
    method: 'POST',
    body: input,
    auth: true,
  });
}

export async function updateFolder(id: string, input: UpdateFolderInput): Promise<SessionFolder> {
  return apiRequest<SessionFolder>(`/folders/${id}`, {
    method: 'PATCH',
    body: input,
    auth: true,
  });
}

export async function deleteFolder(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/folders/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}
