import { createHmac } from 'node:crypto';
import type { Request } from 'express';

/** Android ids are 16 hex characters. Accept a little more so other platforms can fit later. */
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;
const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_.:-]{8,100}$/;
const HALF_HOUR_MS = 30 * 60 * 1000;

export function parseDeviceId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return DEVICE_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/** One-way hash so the database never stores a raw device id. */
export function hashDeviceId(deviceId: string, secret: string): string {
  return createHmac('sha256', secret || 'sessionai-device').update(deviceId).digest('hex');
}

export function deviceHashFromRequest(req: Request, secret: string): string | null {
  const id = parseDeviceId(req.headers['x-device-id']);
  return id ? hashDeviceId(id, secret) : null;
}

/**
 * Conversation id for Voice translate. Older app builds send none, so turns in the same
 * half hour count as one conversation instead of one use per turn.
 */
export function voiceConversationId(header: unknown, now: number = Date.now()): string {
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw === 'string' && CONVERSATION_ID_PATTERN.test(raw.trim())) return raw.trim();
  return `auto:${Math.floor(now / HALF_HOUR_MS)}`;
}
