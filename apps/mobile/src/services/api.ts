import { mobileEnv } from '../lib/env';
import { getCurrentSession } from './auth';
import { getDeviceId } from './device-id';
import { publishIfQuotaBlocked } from './quota-events';

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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** When true, requires a Supabase access token. */
  auth?: boolean;
  /** Override default retry count (network / 429 / 502 / 503). */
  retries?: number;
}

async function getAccessToken(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.access_token ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 429 || status === 502 || status === 503;
}

async function parseJsonBody<T>(response: Response): Promise<ApiSuccessBody<T> | ApiErrorBody> {
  const text = await response.text();
  if (!text) {
    throw new ApiClientError(
      'INVALID_RESPONSE',
      'The API returned an empty response.',
      response.status,
    );
  }
  try {
    return JSON.parse(text) as ApiSuccessBody<T> | ApiErrorBody;
  } catch {
    throw new ApiClientError(
      'INVALID_RESPONSE',
      'The API returned a non-JSON response.',
      response.status,
    );
  }
}

async function executeOnce<T>(path: string, options: RequestOptions): Promise<T> {
  const url = `${mobileEnv.apiBaseUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Free usage is counted per device on the server.
  const deviceId = getDeviceId();
  if (deviceId) headers['x-device-id'] = deviceId;

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
    throw new ApiClientError(
      'NETWORK_ERROR',
      'Unable to reach the Smart Transcriber API. Check Wi‑Fi, that the API is running, and EXPO_PUBLIC_API_BASE_URL uses your computer’s LAN IP (then restart Expo).',
      0,
    );
  }

  const body = await parseJsonBody<T>(response);

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

/**
 * Thin REST client for the Smart Transcriber API.
 * Pass `auth: true` to attach the Supabase access token.
 * Retries transient network / provider errors a few times.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const retries = options.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await executeOnce<T>(path, options);
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof ApiClientError &&
        isRetryableStatus(err.status) &&
        attempt < retries;
      if (!retryable) {
        // Published once, after any retries, so the user sees a single message.
        if (err instanceof ApiClientError) publishIfQuotaBlocked(err.code, err.message);
        throw err;
      }
      await sleep(400 * 2 ** attempt);
    }
  }

  throw lastError;
}

export async function apiGet<T>(path: string, auth = false): Promise<T> {
  return apiRequest<T>(path, { method: 'GET', auth });
}
