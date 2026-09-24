/**
 * Mobile-safe environment values.
 * Only EXPO_PUBLIC_* variables are available in the client bundle.
 * Never put service-role or AI keys here.
 */
import Constants from 'expo-constants';

function readPublic(key: string): string {
  const fromEnv = process.env[key];
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const fromExtra = extra?.[key];
  return typeof fromExtra === 'string' && fromExtra.length > 0 ? fromExtra : '';
}

export const mobileEnv = {
  supabaseUrl: readPublic('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: readPublic('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  apiBaseUrl: readPublic('EXPO_PUBLIC_API_BASE_URL') || 'http://127.0.0.1:3847',
  /** Inbox for Help → Send us a message (mailto). */
  supportEmail:
    readPublic('EXPO_PUBLIC_SUPPORT_EMAIL') || 'andyr@consorttech.com',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(mobileEnv.supabaseUrl && mobileEnv.supabaseAnonKey);
}
