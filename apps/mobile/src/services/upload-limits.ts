export interface UploadLimits {
  /** Largest raw file the API accepts, in MB. */
  maxUploadMb: number;
  /** Longest recording the active transcription provider can handle, in minutes. */
  maxAudioMinutes: number;
}

/** Used until (or unless) GET /limits answers. Matches the API defaults with Whisper. */
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = { maxUploadMb: 100, maxAudioMinutes: 50 };

export const SUPPORTED_MEDIA_LABEL = 'MP3, M4A, WAV, MP4, MOV, WebM';

let cached: UploadLimits | null = null;

export function getCachedUploadLimits(): UploadLimits {
  return cached ?? DEFAULT_UPLOAD_LIMITS;
}

export function setCachedUploadLimits(limits: UploadLimits): void {
  cached = limits;
}

export function hasCachedUploadLimits(): boolean {
  return cached !== null;
}

export function formatLimitMinutes(minutes: number): string {
  if (minutes < 120) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
}

export function uploadLimitHint(limits: UploadLimits = getCachedUploadLimits()): string {
  return `${SUPPORTED_MEDIA_LABEL} · up to ${limits.maxUploadMb} MB and ${formatLimitMinutes(limits.maxAudioMinutes)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

/** Returns a user-facing message when the file is over the size limit, else null. */
export function uploadSizeError(
  sizeBytes: number | null | undefined,
  limits: UploadLimits = getCachedUploadLimits(),
): string | null {
  if (!sizeBytes || sizeBytes <= limits.maxUploadMb * 1024 * 1024) return null;
  return `This file is ${formatFileSize(sizeBytes)} but the limit is ${limits.maxUploadMb} MB. Video files are much larger than audio, so try the audio-only version, a shorter clip, or a compressed export.`;
}

/** Returns a user-facing message when the recording is too long, else null. */
export function durationLimitError(
  durationSeconds: number | null | undefined,
  limits: UploadLimits = getCachedUploadLimits(),
): string | null {
  if (!durationSeconds || durationSeconds <= limits.maxAudioMinutes * 60) return null;
  const minutes = Math.round(durationSeconds / 60);
  return `This recording is ${formatLimitMinutes(minutes)} but the limit is ${formatLimitMinutes(limits.maxAudioMinutes)}. Trim it or split it into shorter parts, then import again.`;
}
