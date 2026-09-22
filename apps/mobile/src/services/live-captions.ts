import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TranscriptSegment } from '@sessionai/shared';
import { mobileEnv } from '../lib/env';
import { getCurrentSession } from './auth';
import { apiRequest } from './api';

export type LiveCaptionStatus = 'idle' | 'connecting' | 'live' | 'error' | 'unsupported';

/** Deepgram language for live captions. Tagalog code is `tl`. */
export type LiveCaptionLanguage = 'multi' | 'en' | 'tl' | 'zh' | 'es' | 'ja' | 'ko';

export const LIVE_CAPTION_LANGUAGES: Array<{
  code: LiveCaptionLanguage;
  label: string;
  hint?: string;
}> = [
  {
    code: 'multi',
    label: 'Auto',
    hint: 'Detects English, Spanish, French, German, Hindi, Russian, Portuguese, Japanese, Italian, Dutch',
  },
  { code: 'tl', label: 'Tagalog' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: 'Chinese' },
  { code: 'es', label: 'Spanish' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
];

const LANGUAGE_PREF_KEY = 'live-caption-language';
const TARGET_SAMPLE_RATE = 16_000;

export async function getLiveCaptionLanguagePref(): Promise<LiveCaptionLanguage> {
  try {
    const raw = await AsyncStorage.getItem(LANGUAGE_PREF_KEY);
    if (LIVE_CAPTION_LANGUAGES.some((o) => o.code === raw)) {
      return raw as LiveCaptionLanguage;
    }
  } catch {
    // ignore
  }
  return 'tl';
}

export async function setLiveCaptionLanguagePref(language: LiveCaptionLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_PREF_KEY, language);
  } catch {
    // ignore
  }
}

export interface LiveCaptionSnapshot {
  status: LiveCaptionStatus;
  finals: string[];
  interim: string;
  error: string | null;
  language: LiveCaptionLanguage;
}

export interface LiveCaptionController {
  start: (opts?: { language?: LiveCaptionLanguage }) => Promise<void>;
  stop: () => Promise<{ text: string; segments: TranscriptSegment[]; language: LiveCaptionLanguage }>;
  pause: () => void;
  resume: () => void;
  setLanguage: (language: LiveCaptionLanguage) => Promise<void>;
  getSnapshot: () => LiveCaptionSnapshot;
  subscribe: (listener: (snap: LiveCaptionSnapshot) => void) => () => void;
}

type LiveMessage = {
  type?: string;
  text?: string;
  isFinal?: boolean;
  start?: number;
  duration?: number;
  message?: string;
  reason?: string;
};

type NativePcmModule = {
  start: (options?: { sampleRate?: number; channels?: number; bitDepth?: number }) => void;
  stop: () => void;
  addListener: (
    event: 'onAudioData',
    callback: (event: { data: string }) => void,
  ) => { remove: () => void };
};

function wsBaseUrl(httpBase: string): string {
  const trimmed = httpBase.replace(/\/$/, '');
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`;
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`;
  return trimmed;
}

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out.buffer;
}

function downsample(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (outputRate === inputRate) return buffer;
  if (outputRate > inputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.max(1, Math.round(buffer.length / ratio));
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i += 1) {
    result[i] = buffer[Math.floor(i * ratio)] ?? 0;
  }
  return result;
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const atobFn = globalThis.atob;
  if (typeof atobFn !== 'function') {
    throw new Error('Base64 decode is unavailable on this device.');
  }
  const binary = atobFn(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function loadNativePcmModule(): NativePcmModule | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    // Optional native module — missing in Expo Go until a dev/EAS build includes it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-audio-stream-pcm') as
      | NativePcmModule
      | { default: NativePcmModule };
    if (mod && typeof (mod as NativePcmModule).start === 'function') {
      return mod as NativePcmModule;
    }
    if (
      mod &&
      typeof (mod as { default?: NativePcmModule }).default?.start === 'function'
    ) {
      return (mod as { default: NativePcmModule }).default;
    }
    return null;
  } catch {
    return null;
  }
}

function isWebAudioSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    (typeof AudioContext !== 'undefined' ||
      typeof (window as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined')
  );
}

export function isLiveCaptionsSupported(): boolean {
  if (isWebAudioSupported()) return true;
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return loadNativePcmModule() != null;
  }
  return false;
}

/**
 * Live captions via authenticated API Deepgram proxy.
 * Web: AudioContext PCM. Native: expo-audio-stream-pcm (dev/EAS build required).
 */
export function createLiveCaptionController(): LiveCaptionController | null {
  const useWeb = isWebAudioSupported();
  const nativePcm = useWeb ? null : loadNativePcmModule();
  if (!useWeb && !nativePcm) return null;

  let status: LiveCaptionStatus = 'idle';
  let finals: string[] = [];
  let interim = '';
  let error: string | null = null;
  let language: LiveCaptionLanguage = 'tl';
  const segments: TranscriptSegment[] = [];
  const listeners = new Set<(snap: LiveCaptionSnapshot) => void>();

  let socket: WebSocket | null = null;
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let silentGain: GainNode | null = null;
  let nativeSub: { remove: () => void } | null = null;
  let nativeActive = false;
  let paused = false;
  let stopping = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let accessToken: string | null = null;
  let reconnectAttempt = 0;
  let audioReady = false;

  function emit() {
    const snap: LiveCaptionSnapshot = {
      status,
      finals: [...finals],
      interim,
      error,
      language,
    };
    for (const listener of listeners) listener(snap);
  }

  function setError(message: string) {
    status = 'error';
    error = message;
    emit();
  }

  function applyTranscriptMessage(msg: LiveMessage) {
    if (msg.type !== 'transcript' || typeof msg.text !== 'string') return;
    if (msg.isFinal) {
      finals = [...finals, msg.text.trim()].filter(Boolean);
      interim = '';
      if (
        typeof msg.start === 'number' &&
        typeof msg.duration === 'number' &&
        msg.text.trim()
      ) {
        segments.push({
          startMs: Math.max(0, Math.round(msg.start * 1000)),
          endMs: Math.max(0, Math.round((msg.start + msg.duration) * 1000)),
          text: msg.text.trim(),
          speaker: null,
        });
      }
    } else {
      interim = msg.text;
    }
    emit();
  }

  function handleSocketMessage(event: MessageEvent) {
    if (typeof event.data !== 'string') return;
    try {
      const msg = JSON.parse(event.data) as LiveMessage;
      if (msg.type === 'ready') {
        status = 'live';
        error = null;
        emit();
        return;
      }
      if (msg.type === 'transcript') {
        applyTranscriptMessage(msg);
        return;
      }
      if (msg.type === 'error') {
        setError(msg.message || 'Live caption stream error');
        return;
      }
      if (msg.type === 'closed' && !stopping) {
        scheduleReconnect();
      }
    } catch {
      // ignore malformed
    }
  }

  function sendPcm(buffer: ArrayBuffer) {
    if (paused || stopping) return;
    if (socket?.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(buffer);
    } catch {
      // reconnect path handles closed sockets
    }
  }

  function teardownSocketOnly() {
    if (socket) {
      try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      } catch {
        // ignore
      }
    }
    socket = null;
  }

  function teardownAudio() {
    if (nativeSub) {
      try {
        nativeSub.remove();
      } catch {
        // ignore
      }
      nativeSub = null;
    }
    if (nativeActive && nativePcm) {
      try {
        nativePcm.stop();
      } catch {
        // ignore
      }
      nativeActive = false;
    }

    try {
      processor?.disconnect();
      sourceNode?.disconnect();
      silentGain?.disconnect();
    } catch {
      // ignore
    }
    processor = null;
    sourceNode = null;
    silentGain = null;
    if (audioContext) {
      void audioContext.close().catch(() => undefined);
    }
    audioContext = null;
    mediaStream?.getTracks().forEach((t) => t.stop());
    mediaStream = null;
    audioReady = false;
  }

  function teardownAll() {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    teardownSocketOnly();
    teardownAudio();
  }

  async function openSocket(token: string): Promise<void> {
    const url =
      `${wsBaseUrl(mobileEnv.apiBaseUrl)}/live/transcribe` +
      `?token=${encodeURIComponent(token)}` +
      `&language=${encodeURIComponent(language)}`;
    const next = new WebSocket(url);
    next.binaryType = 'arraybuffer';
    socket = next;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Live caption connection timed out')), 12_000);

      next.onopen = () => {
        /* wait for ready */
      };

      next.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const msg = JSON.parse(event.data) as LiveMessage;
          if (msg.type === 'ready') {
            clearTimeout(timer);
            status = 'live';
            error = null;
            emit();
            resolve();
            return;
          }
          if (msg.type === 'error') {
            clearTimeout(timer);
            reject(new Error(msg.message || 'Live caption stream failed'));
            return;
          }
          applyTranscriptMessage(msg);
        } catch {
          // ignore
        }
      };

      next.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Could not reach live caption service'));
      };

      next.onclose = () => {
        clearTimeout(timer);
        if (status === 'connecting') {
          reject(new Error('Live caption connection closed'));
        } else if (!stopping) {
          scheduleReconnect();
        }
      };
    });

    next.onmessage = handleSocketMessage;
    next.onclose = () => {
      if (!stopping) scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (stopping || paused || reconnectTimer != null) return;
    if (!accessToken || !audioReady) return;

    status = 'connecting';
    error = 'Reconnecting captions…';
    emit();

    const delay = Math.min(4_000, 600 * 2 ** Math.min(reconnectAttempt, 3));
    reconnectAttempt += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void (async () => {
        if (stopping || !accessToken) return;
        try {
          teardownSocketOnly();
          await openSocket(accessToken);
          reconnectAttempt = 0;
          error = null;
          status = 'live';
          emit();
        } catch (err) {
          error = err instanceof Error ? err.message : 'Live captions disconnected';
          status = 'error';
          emit();
          scheduleReconnect();
        }
      })();
    }, delay);
  }

  function attachWebPcmPipeline(stream: MediaStream) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new Ctx();
    sourceNode = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const rate = audioContext?.sampleRate ?? TARGET_SAMPLE_RATE;
      const down = downsample(input, rate, TARGET_SAMPLE_RATE);
      sendPcm(floatTo16BitPCM(down));
    };

    sourceNode.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);
  }

  function attachNativePcmPipeline(mod: NativePcmModule) {
    nativeSub = mod.addListener('onAudioData', (event) => {
      try {
        sendPcm(base64ToArrayBuffer(event.data));
      } catch {
        // ignore decode/send errors for individual chunks
      }
    });
    mod.start({ sampleRate: TARGET_SAMPLE_RATE, channels: 1, bitDepth: 16 });
    nativeActive = true;
  }

  async function start(opts?: { language?: LiveCaptionLanguage }) {
    if (status === 'connecting' || status === 'live') return;

    stopping = false;
    status = 'connecting';
    error = null;
    finals = [];
    interim = '';
    segments.length = 0;
    reconnectAttempt = 0;
    if (opts?.language) {
      language = opts.language;
      void setLiveCaptionLanguagePref(language);
    } else {
      language = await getLiveCaptionLanguagePref();
    }
    emit();

    const session = await getCurrentSession();
    const token = session?.access_token;
    if (!token) {
      setError('Sign in to use live captions.');
      return;
    }
    accessToken = token;

    try {
      if (useWeb) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: TARGET_SAMPLE_RATE,
          },
          video: false,
        });
      }

      await openSocket(token);

      if (useWeb && mediaStream) {
        attachWebPcmPipeline(mediaStream);
        if (audioContext?.state === 'suspended') {
          await audioContext.resume();
        }
      } else if (nativePcm) {
        attachNativePcmPipeline(nativePcm);
      } else {
        throw new Error('Live captions are not available on this build.');
      }

      audioReady = true;
      paused = false;
      status = 'live';
      emit();
    } catch (err) {
      teardownAll();
      const message =
        err instanceof Error ? err.message : 'Live captions failed to start';
      setError(
        Platform.OS !== 'web' && /native module|ExpoAudioStream|null/i.test(message)
          ? 'Live captions need a development or EAS build (not Expo Go).'
          : message,
      );
      throw err;
    }
  }

  function pause() {
    paused = true;
  }

  function resume() {
    paused = false;
    if (audioContext?.state === 'suspended') {
      void audioContext.resume();
    }
  }

  async function setLanguage(next: LiveCaptionLanguage) {
    if (next === language) return;
    language = next;
    void setLiveCaptionLanguagePref(next);
    emit();

    if (stopping || !accessToken || !audioReady) return;
    if (status !== 'live' && status !== 'connecting' && status !== 'error') return;

    const trailing = interim.trim();
    if (trailing) {
      finals = [...finals, trailing];
      interim = '';
      emit();
    }

    status = 'connecting';
    error = null;
    emit();
    try {
      teardownSocketOnly();
      await openSocket(accessToken);
      reconnectAttempt = 0;
      status = 'live';
      emit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch caption language');
      scheduleReconnect();
    }
  }

  async function stop(): Promise<{
    text: string;
    segments: TranscriptSegment[];
    language: LiveCaptionLanguage;
  }> {
    stopping = true;
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: 'CloseStream' }));
      } catch {
        // ignore
      }
    }

    await new Promise((r) => setTimeout(r, 500));
    teardownAll();

    const trailing = interim.trim();
    if (trailing) {
      finals = [...finals, trailing];
      interim = '';
    }
    status = 'idle';
    emit();

    const text = finals.join(' ').replace(/\s+/g, ' ').trim();
    return { text, segments: [...segments], language };
  }

  return {
    start,
    stop,
    pause,
    resume,
    setLanguage,
    getSnapshot: () => ({ status, finals: [...finals], interim, error, language }),
    subscribe: (listener) => {
      listeners.add(listener);
      listener({ status, finals: [...finals], interim, error, language });
      return () => listeners.delete(listener);
    },
  };
}

export async function saveLiveTranscript(
  sessionId: string,
  text: string,
  segments: TranscriptSegment[],
  language: LiveCaptionLanguage | null = null,
): Promise<void> {
  if (!text.trim()) return;
  await apiRequest(`/sessions/${sessionId}/transcript`, {
    method: 'PUT',
    auth: true,
    body: {
      text: text.trim(),
      language,
      segments,
    },
    retries: 1,
  });
}
