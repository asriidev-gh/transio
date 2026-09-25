import { z } from 'zod';

/**
 * Server-only environment configuration.
 * Never expose SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, TRANSCRIPTION_API_KEY,
 * or DEEPGRAM_API_KEY to the client.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3847),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().optional().default('claude-sonnet-4-5'),
  /** Faster model for Translate + Live Note Taker merges (defaults to Haiku). */
  ANTHROPIC_TRANSLATE_MODEL: z.string().optional().default('claude-haiku-4-5'),
  TRANSCRIPTION_API_KEY: z.string().optional().default(''),
  TRANSCRIPTION_BASE_URL: z.string().default(''),
  /** Batch STT engine: whisper (default) or deepgram (real speaker diarization; uses DEEPGRAM_API_KEY). */
  TRANSCRIPTION_PROVIDER: z.enum(['whisper', 'deepgram']).default('whisper'),
  /** Live captions WebSocket proxy (Deepgram Listen). Server-only. */
  DEEPGRAM_API_KEY: z.string().optional().default(''),
  /** Background jobs (transcribe / summarize) that may run at once in this process. */
  JOB_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  /** Uploads / link imports held in memory at once. Extra requests get a 503 + Retry-After. */
  MAX_CONCURRENT_UPLOADS: z.coerce.number().int().min(1).max(8).default(2),
  /**
   * Server-side usage limits. off: none. log: count and log what would be blocked (safe default
   * until billing is live). on: block requests over the limit.
   */
  QUOTA_MODE: z.enum(['off', 'log', 'on']).default('log'),
  /** Free uses per feature, tracked per device. */
  FREE_LIMIT: z.coerce.number().int().min(0).max(1000).default(2),
  /** Pro uses per feature per UTC day, tracked per account. */
  PRO_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
  /** Spend kill switch: max uses per feature per UTC day across all users. */
  GLOBAL_DAILY_LIMITS: z.string().default('session=300,summary=300,voiceTranslate=3000'),
  /** Secret for hashing device ids before they are stored. */
  DEVICE_HASH_SECRET: z.string().optional().default(''),
  /** Live caption streams one user may hold open at once. */
  MAX_LIVE_STREAMS_PER_USER: z.coerce.number().int().min(1).max(5).default(2),
  /** Hard cap on one live caption stream, in minutes. */
  LIVE_MAX_MINUTES: z.coerce.number().int().min(5).max(600).default(180),
  /** A session stuck transcribing/summarizing longer than this is marked failed. */
  JOB_STALE_MINUTES: z.coerce.number().int().min(5).max(720).default(30),
  /**
   * Comma-separated browser origins allowed to call the API (CORS).
   * Empty in development = allow all (local Expo web).
   * In production, set explicitly (e.g. https://app.example.com).
   */
  CORS_ORIGINS: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) {
    return cached;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cached = parsed.data;
  return cached;
}

export function isSupabaseConfigured(env: Env = getEnv()): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

/** Reset cached env — used in tests only. */
export function resetEnvCache(): void {
  cached = null;
}
