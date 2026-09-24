import { isIP } from 'node:net';
import { AppError } from '../../middleware/error-handler.js';
import { maxUploadBytes } from '../../lib/limits.js';

const BLOCKED_HOST_SUFFIXES = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
  'tiktok.com',
  'facebook.com',
  'fb.watch',
  'fbcdn.net',
  'instagram.com',
  'twitter.com',
  'x.com',
  't.co',
  'dailymotion.com',
  'twitch.tv',
  'reddit.com',
];

const PAGE_LINK_MESSAGE =
  'That looks like a video page, not a file. Download the video yourself, then upload it — or paste a direct link to an .mp4, .webm, .mp3, or similar file.';

export const MAX_REMOTE_MEDIA_BYTES = maxUploadBytes();

export function hostnameOf(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

export function isBlockedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function isPrivateOrLocalIp(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^::ffff:/, '');
  if (!value) return true;
  if (value === '::1' || value === '0.0.0.0' || value === '::') return true;
  if (value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return true;

  const v4 = value.includes(':') ? null : value;
  if (!v4) return false;

  const parts = v4.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a = 0, b = 0] = parts;
  if (a === 10 || a === 127 || a === 0 || a === 255) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function assertSafeMediaUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Enter a valid media URL', 400);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AppError('VALIDATION_ERROR', 'Media URLs must start with https://', 400);
  }

  const host = hostnameOf(parsed);
  if (!host) {
    throw new AppError('VALIDATION_ERROR', 'Enter a valid media URL', 400);
  }

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new AppError('VALIDATION_ERROR', 'Local URLs cannot be imported', 400);
  }

  if (isIP(host) && isPrivateOrLocalIp(host)) {
    throw new AppError('VALIDATION_ERROR', 'Local URLs cannot be imported', 400);
  }

  if (isBlockedMediaHost(host)) {
    throw new AppError('VALIDATION_ERROR', PAGE_LINK_MESSAGE, 400);
  }

  return parsed;
}
