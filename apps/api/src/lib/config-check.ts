import type { Env } from './env.js';

/**
 * Settings a production API needs to work. Returned as a list so startup can log it loudly
 * without refusing to boot, since a partial deploy still serves health checks and other routes.
 */
export function missingProductionConfig(env: Env): string[] {
  if (env.NODE_ENV !== 'production') return [];

  const missing: string[] = [];
  if (!env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!env.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
  if (!env.DEVICE_HASH_SECRET) missing.push('DEVICE_HASH_SECRET');

  if (env.TRANSCRIPTION_PROVIDER === 'deepgram') {
    if (!env.DEEPGRAM_API_KEY) missing.push('DEEPGRAM_API_KEY (needed by TRANSCRIPTION_PROVIDER=deepgram)');
  } else if (!env.TRANSCRIPTION_API_KEY) {
    missing.push('TRANSCRIPTION_API_KEY');
  }

  return missing;
}
