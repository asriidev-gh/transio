/**
 * Rough wait for batch transcription, in whole minutes.
 * These are expectations, not a progress measurement: Whisper cloud is often
 * around one sixth to one tenth of the recording, and Deepgram is much faster.
 */
export interface TranscriptionEstimate {
  low: number;
  high: number;
}

/** Deepgram's length cap is hours; Whisper's is about 50 minutes. */
function usesDeepgram(maxAudioMinutes: number): boolean {
  return maxAudioMinutes > 80;
}

export function estimateTranscriptionMinutes(
  durationSeconds: number | null | undefined,
  maxAudioMinutes = 50,
): TranscriptionEstimate | null {
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  const audioMinutes = durationSeconds / 60;
  const lowRatio = usesDeepgram(maxAudioMinutes) ? 20 : 10;
  const highRatio = usesDeepgram(maxAudioMinutes) ? 10 : 6;
  const low = Math.max(1, Math.ceil(audioMinutes / lowRatio));
  const high = Math.max(low, Math.ceil(audioMinutes / highRatio));
  return { low, high };
}

/** "about 4–7 minutes" or "about 1 minute". */
export function transcriptionEstimatePhrase(
  durationSeconds: number | null | undefined,
  maxAudioMinutes = 50,
): string | null {
  const range = estimateTranscriptionMinutes(durationSeconds, maxAudioMinutes);
  if (!range) return null;
  if (range.low === range.high) {
    return range.low === 1 ? 'about 1 minute' : `about ${range.low} minutes`;
  }
  return `about ${range.low}–${range.high} minutes`;
}

export function transcriptionEstimateSentence(
  durationSeconds: number | null | undefined,
  maxAudioMinutes = 50,
): string | null {
  const phrase = transcriptionEstimatePhrase(durationSeconds, maxAudioMinutes);
  if (!phrase) return null;
  return `Transcription usually finishes in ${phrase}.`;
}
