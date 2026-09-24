import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import { AppError } from '../../middleware/error-handler.js';
import { getEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';

export const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
/** Supabase `session-audio` bucket cap is 100 MB; stay just under it. */
export const STORAGE_MAX_BYTES = 99 * 1024 * 1024;
/** Long meeting recordings can take a while to convert. */
const FFMPEG_TIMEOUT_MS = 15 * 60 * 1000;

/** Largest prepared (post-conversion) file the active transcription provider can take. */
export function transcriptionMaxBytes(): number {
  return getEnv().TRANSCRIPTION_PROVIDER === 'deepgram' ? STORAGE_MAX_BYTES : WHISPER_MAX_BYTES;
}

function maxMinutesAt64k(bytes: number): number {
  // 64 kbps mono mp3 = 480 KB per minute.
  return Math.floor(bytes / (480 * 1024));
}

/** Prefer a system ffmpeg; fall back to the bundled ffmpeg-static binary. */
function ffmpegCommand(): string {
  const bundled = typeof ffmpegStatic === 'string' ? ffmpegStatic : null;
  return process.env.FFMPEG_PATH?.trim() || bundled || 'ffmpeg';
}

const WHISPER_AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
]);

const WHISPER_CONTAINER_MIME = new Set([
  ...WHISPER_AUDIO_MIME,
  'video/mp4',
  'video/webm',
  'video/mpeg',
]);

const VIDEO_MIME_PREFIX = 'video/';

export interface MediaBytes {
  data: Buffer;
  mimeType: string;
  fileName: string;
}

function extOf(fileName: string): string {
  return extname(fileName).replace('.', '').toLowerCase();
}

export function isVideoMedia(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith(VIDEO_MIME_PREFIX)) return true;
  return /\.(mp4|mov|mkv|avi|m4v|webm)$/i.test(fileName);
}

export function isAllowedUploadMedia(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('audio/')) return true;
  if (mime === 'application/octet-stream') {
    return /\.(mp3|m4a|mp4|wav|webm|ogg|aac|flac|caf|mov|mkv|m4v)$/i.test(fileName);
  }
  if (
    mime === 'video/mp4' ||
    mime === 'video/webm' ||
    mime === 'video/quicktime' ||
    mime === 'video/x-matroska' ||
    mime === 'video/mpeg' ||
    mime === 'video/x-m4v'
  ) {
    return true;
  }
  return isVideoMedia(mime, fileName) && /\.(mp4|mov|mkv|webm|m4v)$/i.test(fileName);
}

function looksLikeWhisperAudio(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  if (WHISPER_AUDIO_MIME.has(mime)) return true;
  return /\.(mp3|m4a|wav|webm|ogg|flac|aac)$/i.test(fileName);
}

function looksLikeWhisperContainer(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  if (WHISPER_CONTAINER_MIME.has(mime)) return true;
  return /\.(mp3|m4a|mp4|wav|webm|ogg|flac|mpeg)$/i.test(fileName);
}

async function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegCommand(), ['-version'], { windowsHide: true });
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    child.on('error', () => done(false));
    child.on('close', (code) => done(code === 0));
    setTimeout(() => {
      child.kill();
      done(false);
    }, 4000);
  });
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegCommand(), args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('ffmpeg timed out'));
    }, timeoutMs);
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 8000) stderr = stderr.slice(-4000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exited ${code}`));
    });
  });
}

async function extractWithFfmpeg(input: MediaBytes): Promise<MediaBytes | null> {
  const available = await ffmpegAvailable();
  if (!available) return null;

  const dir = await mkdtemp(join(tmpdir(), 'sessionai-media-'));
  const inExt = extOf(input.fileName) || 'bin';
  const inputPath = join(dir, `source.${inExt}`);
  const outputPath = join(dir, 'audio.mp3');

  try {
    await writeFile(inputPath, input.data);
    await runFfmpeg(
      [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        '64k',
        '-f',
        'mp3',
        outputPath,
      ],
      FFMPEG_TIMEOUT_MS,
    );
    const data = await readFile(outputPath);
    if (data.byteLength < 32) return null;
    return {
      data,
      mimeType: 'audio/mpeg',
      fileName: 'audio.mp3',
    };
  } catch (err) {
    logger.warn('ffmpeg audio extract failed', {
      message: err instanceof Error ? err.message : 'unknown',
      fileName: input.fileName,
    });
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Prefer compact speech audio (24 MB cap for Whisper, ~99 MB for Deepgram). Video is remuxed when ffmpeg is installed.
 */
export async function prepareMediaForTranscription(input: MediaBytes): Promise<MediaBytes> {
  const maxBytes = transcriptionMaxBytes();
  const needsExtract =
    isVideoMedia(input.mimeType, input.fileName) || input.data.byteLength > maxBytes;

  if (!needsExtract && looksLikeWhisperAudio(input.mimeType, input.fileName)) {
    return input;
  }

  if (needsExtract) {
    const extracted = await extractWithFfmpeg(input);
    if (extracted) {
      if (extracted.data.byteLength > maxBytes) {
        throw new AppError(
          'VALIDATION_ERROR',
          `That recording is too long for transcription after converting to audio (limit about ${maxMinutesAt64k(maxBytes)} minutes). Try a shorter clip.`,
          400,
        );
      }
      return extracted;
    }
  }

  if (looksLikeWhisperContainer(input.mimeType, input.fileName)) {
    if (input.data.byteLength > maxBytes) {
      throw new AppError(
        'VALIDATION_ERROR',
        `File is too large for transcription (max ~${Math.floor(maxBytes / (1024 * 1024))} MB when audio cannot be converted). Upload a shorter or compressed file.`,
        400,
      );
    }
    return input;
  }

  throw new AppError(
    'VALIDATION_ERROR',
    'Could not read audio from that file. Upload mp3, m4a, wav, mp4, or webm.',
    400,
  );
}
