import { mobileEnv } from '../lib/env';

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

/**
 * Thin REST client for the SessionAI API.
 * Auth headers are added in Phase 2.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const url = `${mobileEnv.apiBaseUrl.replace(/\/$/, '')}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
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
