/** Upper bounds for outbound provider calls so a hung upstream cannot pin a job and its buffers. */
export const PROVIDER_TIMEOUT_MS = {
  /** Claude calls (summary, ask, translate, speaker labels). */
  anthropic: 180_000,
  /** Whisper accepts at most about 25 MB per request. */
  whisper: 300_000,
  /** Deepgram pre-recorded files can be large, but it transcribes far faster than real time. */
  deepgram: 600_000,
} as const;
