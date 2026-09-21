import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { AppError } from '../../middleware/error-handler.js';
import { logger } from '../../lib/logger.js';

export const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

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
    const child = spawn('ffmpeg', ['-version'], { windowsHide: true });
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
    const child = spawn('ffmpeg', args, { windowsHide: true });
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
      5 * 60 * 1000,
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
 * Prefer compact speech audio for Whisper (25 MB cap). Video is remuxed when ffmpeg is installed.
 */
export async function prepareMediaForTranscription(input: MediaBytes): Promise<MediaBytes> {
  const needsExtract =
    isVideoMedia(input.mimeType, input.fileName) || input.data.byteLength > WHISPER_MAX_BYTES;

  if (!needsExtract && looksLikeWhisperAudio(input.mimeType, input.fileName)) {
    return input;
  }

  if (needsExtract) {
    const extracted = await extractWithFfmpeg(input);
    if (extracted) {
      if (extracted.data.byteLength > WHISPER_MAX_BYTES) {
        throw new AppError(
          'VALIDATION_ERROR',
          'That recording is too long for transcription after converting to audio. Try a shorter clip.',
          400,
        );
      }
      return extracted;
    }
  }

  if (looksLikeWhisperContainer(input.mimeType, input.fileName)) {
    if (input.data.byteLength > WHISPER_MAX_BYTES) {
      throw new AppError(
        'VALIDATION_ERROR',
        'File is too large for transcription (max ~25 MB without ffmpeg). Install ffmpeg on the API host or upload a shorter/compressed file.',
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
