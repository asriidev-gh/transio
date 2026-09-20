import type { AuthError, Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/src/lib/supabase';
import { isSupabaseConfigured } from '@/src/lib/env';
import { mapAuthErrorMessage } from '@/src/utils/auth-errors';

export class AuthServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

function toAuthError(error: AuthError | null): AuthServiceError {
  return new AuthServiceError(mapAuthErrorMessage(error?.message));
}

function assertConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new AuthServiceError(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the app.',
    );
  }
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  assertConfigured();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.session) {
    throw toAuthError(error);
  }

  return data.session;
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<{ session: Session | null; user: User; needsEmailConfirmation: boolean }> {
  assertConfigured();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    throw toAuthError(error);
  }

  return {
    session: data.session,
    user: data.user,
    needsEmailConfirmation: !data.session,
  };
}

export async function signOut(): Promise<void> {
  assertConfigured();
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw toAuthError(error);
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw toAuthError(error);
  }
  return data.session;
}
