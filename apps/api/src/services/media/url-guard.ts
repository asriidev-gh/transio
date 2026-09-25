import { BlockList, isIP } from 'node:net';
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

/** Addresses a media import must never connect to: private, loopback, link-local, reserved. */
const NON_PUBLIC = new BlockList();
const V4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];
const V6_RANGES: Array<[string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];
for (const [address, prefix] of V4_RANGES) NON_PUBLIC.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of V6_RANGES) NON_PUBLIC.addSubnet(address, prefix, 'ipv6');

/**
 * True for anything that is not a public unicast address. Unparseable input counts as unsafe.
 * IPv4-mapped IPv6 (::ffff:a.b.c.d or the hex form) is checked against the IPv4 ranges.
 */
export function isPrivateOrLocalIp(ip: string): boolean {
  const value = ip.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const family = isIP(value);
  if (family === 0) return true;
  return NON_PUBLIC.check(value, family === 6 ? 'ipv6' : 'ipv4');
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
