import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv, isSupabaseConfigured } from './env.js';

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Browser/anon-equivalent client for server use when acting on behalf of a user JWT.
 * Phase 1 only verifies configuration; auth middleware arrives in Phase 2.
 */
export function getSupabaseAnonClient(): SupabaseClient {
  const env = getEnv();
  if (!isSupabaseConfigured(env) || !env.SUPABASE_URL) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  if (!anonClient) {
    anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return anonClient;
}

/**
 * Service-role client — server-side only. Bypasses RLS. Use sparingly.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase service role is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  if (!serviceClient) {
    serviceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serviceClient;
}

export function getSupabaseConfigStatus(): {
  configured: boolean;
  hasServiceRole: boolean;
} {
  const env = getEnv();
  return {
    configured: isSupabaseConfigured(env),
    hasServiceRole: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
