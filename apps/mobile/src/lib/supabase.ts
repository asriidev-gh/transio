import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, mobileEnv } from './env';

let client: SupabaseClient | null = null;

/**
 * Supabase browser/mobile client using the anon key only.
 * Auth (Phase 2) will use this client; Phase 1 only establishes configuration.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  if (!client) {
    client = createClient(mobileEnv.supabaseUrl, mobileEnv.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}

export function getSupabaseConfigStatus(): {
  configured: boolean;
  urlHost: string | null;
} {
  if (!isSupabaseConfigured()) {
    return { configured: false, urlHost: null };
  }

  try {
    const host = new URL(mobileEnv.supabaseUrl).host;
    return { configured: true, urlHost: host };
  } catch {
    return { configured: false, urlHost: null };
  }
}
