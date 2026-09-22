import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { getEnv } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { getSupabaseAnonClient } from '../lib/supabase.js';

const LIVE_PATH = '/live/transcribe';

/** Allowed Deepgram language codes for live captions. */
const LIVE_LANGUAGES = new Set([
  'en',
  'tl',
  'zh',
  'zh-CN',
  'zh-TW',
  'es',
  'ja',
  'ko',
  'fr',
  'de',
  'pt',
  'id',
  'ms',
  'th',
  'vi',
  'hi',
  'multi',
]);

/**
 * Deepgram Listen v1 — expect raw linear16 PCM from the browser AudioContext path.
 * Defaults to Tagalog (`tl`); pass `?language=` for other supported codes.
 */
function deepgramListenUrl(language: string): string {
  const params = new URLSearchParams({
    model: 'nova-3',
    language,
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    smart_format: 'true',
    interim_results: 'true',
    punctuate: 'true',
    endpointing: language === 'multi' ? '100' : '300',
    utterance_end_ms: '1000',
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

function resolveLiveLanguage(raw: string | null | undefined): string {
  const v = (raw ?? 'tl').trim().toLowerCase();
  if (v === 'fil' || v === 'filipino' || v === 'tagalog') return 'tl';
  if (v === 'en-us' || v === 'english') return 'en';
  if (v === 'zh-hans' || v === 'zh-cn' || v === 'chinese' || v === 'mandarin') return 'zh';
  if (v === 'zh-hant' || v === 'zh-tw') return 'zh-TW';
  if (v === 'es-419' || v === 'spanish') return 'es';
  if (v === 'japanese') return 'ja';
  if (v === 'korean') return 'ko';
  if (v === 'auto' || v === 'detect') return 'multi';
  if (LIVE_LANGUAGES.has(v)) return v;
  return 'tl';
}

function parseHeaderToken(req: IncomingMessage): string | null {
  try {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const [scheme, token] = auth.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) return null;
    return token.trim();
  } catch {
    return null;
  }
}

function parseLanguage(req: IncomingMessage): string {
  try {
    const host = req.headers.host ?? 'localhost';
    const url = new URL(req.url ?? '/', `http://${host}`);
    return resolveLiveLanguage(url.searchParams.get('language'));
  } catch {
    return 'tl';
  }
}

function isLivePath(req: IncomingMessage): boolean {
  try {
    const host = req.headers.host ?? 'localhost';
    const url = new URL(req.url ?? '/', `http://${host}`);
    return url.pathname === LIVE_PATH;
  } catch {
    return false;
  }
}

function sendJson(socket: WebSocket, payload: Record<string, unknown>): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function dataToUtf8(data: WebSocket.RawData): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}

/**
 * Wait for `{ "type": "auth", "token": "<jwt>" }` before proxying.
 * Query-string tokens are rejected (they leak into proxy/access logs).
 */
function awaitAuthToken(client: WebSocket, headerToken: string | null): Promise<string> {
  if (headerToken) return Promise.resolve(headerToken);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('AUTH_TIMEOUT'));
    }, 10_000);

    function onMessage(data: WebSocket.RawData, isBinary: boolean) {
      if (isBinary) return;
      try {
        const parsed = JSON.parse(dataToUtf8(data)) as { type?: string; token?: string };
        if (parsed.type !== 'auth') return;
        const token = typeof parsed.token === 'string' ? parsed.token.trim() : '';
        if (!token) {
          cleanup();
          reject(new Error('AUTH_MISSING_TOKEN'));
          return;
        }
        cleanup();
        resolve(token);
      } catch {
        // ignore non-JSON until timeout
      }
    }

    function onClose() {
      cleanup();
      reject(new Error('AUTH_CLOSED'));
    }

    function cleanup() {
      clearTimeout(timer);
      client.off('message', onMessage);
      client.off('close', onClose);
    }

    client.on('message', onMessage);
    client.on('close', onClose);
  });
}

function mapDeepgramMessage(raw: unknown): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    const text =
      typeof raw === 'string'
        ? raw
        : Buffer.isBuffer(raw)
          ? raw.toString('utf8')
          : Buffer.from(raw as ArrayBuffer).toString('utf8');
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const msg = parsed as {
    type?: unknown;
    is_final?: unknown;
    speech_final?: unknown;
    start?: unknown;
    duration?: unknown;
    channel?: { alternatives?: Array<{ transcript?: unknown }> };
    description?: unknown;
    message?: unknown;
  };

  if (msg.type === 'Results') {
    const transcript =
      typeof msg.channel?.alternatives?.[0]?.transcript === 'string'
        ? msg.channel.alternatives[0].transcript
        : '';
    if (!transcript.trim()) return null;
    return {
      type: 'transcript',
      text: transcript,
      isFinal: msg.is_final === true,
      speechFinal: msg.speech_final === true,
      start:
        typeof msg.start === 'number' && Number.isFinite(msg.start) ? msg.start : undefined,
      duration:
        typeof msg.duration === 'number' && Number.isFinite(msg.duration)
          ? msg.duration
          : undefined,
    };
  }

  if (msg.type === 'Error') {
    const detail =
      (typeof msg.description === 'string' && msg.description) ||
      (typeof msg.message === 'string' && msg.message) ||
      'Deepgram reported a streaming error.';
    return {
      type: 'error',
      message: detail,
    };
  }

  return null;
}

/**
 * Attach authenticated Deepgram live-transcribe WebSocket proxy.
 * Clients connect to `ws(s)://host/live/transcribe?language=…`, then send
 * `{ "type": "auth", "token": "<supabase_jwt>" }` as the first message
 * (or pass `Authorization: Bearer` on upgrade when the runtime allows headers).
 * Query-string tokens are not accepted.
 */
export function attachLiveTranscribeServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (!isLivePath(req)) {
      return;
    }

    wss.handleUpgrade(req, socket, head, (client) => {
      wss.emit('connection', client, req);
    });
  });

  wss.on('connection', (client, req) => {
    void handleConnection(client, req);
  });

  logger.info('Live Deepgram proxy attached', { path: LIVE_PATH });
  return wss;
}

async function handleConnection(client: WebSocket, req: IncomingMessage): Promise<void> {
  const env = getEnv();
  if (!env.DEEPGRAM_API_KEY) {
    sendJson(client, {
      type: 'error',
      message: 'Live captions are not configured on this server.',
      code: 'DEEPGRAM_NOT_CONFIGURED',
    });
    client.close(4003, 'Deepgram not configured');
    return;
  }

  let token: string;
  try {
    token = await awaitAuthToken(client, parseHeaderToken(req));
  } catch (err) {
    const code = err instanceof Error ? err.message : 'AUTH_FAILED';
    sendJson(client, {
      type: 'error',
      message:
        code === 'AUTH_TIMEOUT'
          ? 'Send an auth message within 10 seconds.'
          : 'Authentication required. Send { "type": "auth", "token": "<jwt>" }.',
      code: 'UNAUTHORIZED',
    });
    client.close(4001, 'Unauthorized');
    return;
  }

  try {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      sendJson(client, {
        type: 'error',
        message: 'Invalid or expired session.',
        code: 'UNAUTHORIZED',
      });
      client.close(4001, 'Unauthorized');
      return;
    }
  } catch (err) {
    logger.error('Live caption auth failed', {
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    sendJson(client, {
      type: 'error',
      message: 'Authentication service unavailable.',
      code: 'SERVICE_UNAVAILABLE',
    });
    client.close(1011, 'Auth unavailable');
    return;
  }

  const deepgram = new WebSocket(deepgramListenUrl(parseLanguage(req)), {
    headers: {
      Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
    },
  });

  let closed = false;
  // Deepgram closes after ~10s with no audio; docs recommend KeepAlive every 3–5s.
  const keepAlive = setInterval(() => {
    if (deepgram.readyState === WebSocket.OPEN) {
      deepgram.send(JSON.stringify({ type: 'KeepAlive' }));
    }
  }, 3_000);

  const cleanup = (reason: string) => {
    if (closed) return;
    closed = true;
    clearInterval(keepAlive);
    try {
      if (deepgram.readyState === WebSocket.OPEN) {
        deepgram.send(JSON.stringify({ type: 'CloseStream' }));
      }
    } catch {
      // ignore
    }
    if (deepgram.readyState === WebSocket.OPEN || deepgram.readyState === WebSocket.CONNECTING) {
      deepgram.close();
    }
    if (client.readyState === WebSocket.OPEN) {
      sendJson(client, { type: 'closed', reason });
      client.close();
    }
  };

  deepgram.on('open', () => {
    sendJson(client, { type: 'ready' });
  });

  deepgram.on('message', (data) => {
    const mapped = mapDeepgramMessage(data);
    if (mapped) {
      sendJson(client, mapped);
    }
  });

  deepgram.on('error', (err) => {
    logger.error('Deepgram socket error', { message: err.message });
    sendJson(client, {
      type: 'error',
      message: 'Live caption stream failed.',
      code: 'DEEPGRAM_ERROR',
    });
    cleanup('deepgram_error');
  });

  deepgram.on('close', () => {
    cleanup('deepgram_closed');
  });

  client.on('message', (data, isBinary) => {
    if (deepgram.readyState !== WebSocket.OPEN) return;

    if (isBinary) {
      if (Buffer.isBuffer(data)) {
        deepgram.send(data);
      } else if (data instanceof ArrayBuffer) {
        deepgram.send(Buffer.from(data));
      } else if (Array.isArray(data)) {
        deepgram.send(Buffer.concat(data));
      }
      return;
    }

    try {
      const text = dataToUtf8(data);
      const parsed = JSON.parse(text) as { type?: string };
      if (parsed.type === 'CloseStream') {
        cleanup('client_close');
        return;
      }
      if (parsed.type === 'KeepAlive') {
        deepgram.send(JSON.stringify({ type: 'KeepAlive' }));
      }
      // Ignore late/duplicate auth frames after handshake.
    } catch {
      // ignore non-JSON text
    }
  });

  client.on('close', () => {
    cleanup('client_disconnect');
  });

  client.on('error', () => {
    cleanup('client_error');
  });
}

/** Exported for unit tests. */
export const __test = {
  mapDeepgramMessage,
  isLivePath,
  LIVE_PATH,
  resolveLiveLanguage,
  parseHeaderToken,
};
