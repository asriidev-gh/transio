import { z } from 'zod';

export const SESSION_AUDIO_BUCKET = 'session-audio' as const;

export const AudioUploadResultSchema = z.object({
  sessionId: z.string().uuid(),
  audioPath: z.string().min(1),
  status: z.literal('uploaded'),
});

export type AudioUploadResult = z.infer<typeof AudioUploadResultSchema>;

export const SignedAudioUrlSchema = z.object({
  url: z.string().url(),
  expiresIn: z.number().int().positive(),
  audioPath: z.string().min(1),
});

export type SignedAudioUrl = z.infer<typeof SignedAudioUrlSchema>;

/**
 * Builds a private storage object path scoped to the owning user.
 * Example: `userId/sessionId/audio.m4a`
 */
export function buildSessionAudioPath(
  userId: string,
  sessionId: string,
  extension: string,
): string {
  const safeExt = extension.replace(/^\./, '').toLowerCase() || 'm4a';
  return `${userId}/${sessionId}/audio.${safeExt}`;
}

export function extensionFromMimeType(mimeType: string | undefined): string {
  const normalized = (mimeType ?? '').toLowerCase();
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('m4a') || normalized.includes('mp4') || normalized.includes('aac')) {
    return 'm4a';
  }
  return 'm4a';
}
