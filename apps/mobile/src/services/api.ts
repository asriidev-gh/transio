import { mobileEnv } from '../lib/env';
import { getCurrentSession } from './auth';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

interface ApiErrorBody {
  success: false;
  error: { code: string; message: string };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** When true, requires a Supabase access token. */
  auth?: boolean;
}

async function getAccessToken(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.access_token ?? null;
}

/**
 * Thin REST client for the SessionAI API.
 * Pass `auth: true` to attach the Supabase access token.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${mobileEnv.apiBaseUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth) {
    const token = await getAccessToken();
    if (!token) {
      throw new ApiClientError('UNAUTHORIZED', 'You must be signed in.', 401);
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError('NETWORK_ERROR', 'Unable to reach the SessionAI API.', 0);
  }

  const body = (await response.json()) as ApiSuccessBody<T> | ApiErrorBody;

  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorBody;
    throw new ApiClientError(
      errorBody.error?.code ?? 'REQUEST_FAILED',
      errorBody.error?.message ?? 'Request failed',
      response.status,
    );
  }

  return body.data;
}

export async function apiGet<T>(path: string, auth = false): Promise<T> {
  return apiRequest<T>(path, { method: 'GET', auth });
}
