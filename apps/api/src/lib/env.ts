import { z } from 'zod';

/**
 * Server-only environment configuration.
 * Never expose SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, or TRANSCRIPTION_API_KEY to the client.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3847),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().optional().default('claude-sonnet-4-5'),
  /** Faster model for on-demand Translate (defaults to Haiku). */
  ANTHROPIC_TRANSLATE_MODEL: z.string().optional().default('claude-haiku-4-5'),
  TRANSCRIPTION_API_KEY: z.string().optional().default(''),
  TRANSCRIPTION_BASE_URL: z.string().default(''),
  LOG_SENSITIVE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
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
