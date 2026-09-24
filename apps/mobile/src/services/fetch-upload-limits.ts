import { apiGet } from '@/src/services/api';
import {
  DEFAULT_UPLOAD_LIMITS,
  getCachedUploadLimits,
  hasCachedUploadLimits,
  setCachedUploadLimits,
  type UploadLimits,
} from '@/src/services/upload-limits';

/** Fetch the API's real limits once; falls back to defaults when offline or on older APIs. */
export async function fetchUploadLimits(): Promise<UploadLimits> {
  if (hasCachedUploadLimits()) return getCachedUploadLimits();
  try {
    const data = await apiGet<Partial<UploadLimits>>('/limits');
    if (
      typeof data.maxUploadMb === 'number' &&
      typeof data.maxAudioMinutes === 'number' &&
      data.maxUploadMb > 0 &&
      data.maxAudioMinutes > 0
    ) {
      const limits = { maxUploadMb: data.maxUploadMb, maxAudioMinutes: data.maxAudioMinutes };
      setCachedUploadLimits(limits);
      return limits;
    }
  } catch {
    // keep defaults
  }
  return DEFAULT_UPLOAD_LIMITS;
}
