import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/src/lib/env';
import { getSupabaseClient } from '@/src/lib/supabase';
import * as authService from '@/src/services/auth';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
  /** Guest (anonymous) session — can use the app before saving an email. */
  isAnonymous: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  /** Enter the app without email — creates/keeps an anonymous Supabase session. */
  continueAsGuest: () => Promise<void>;
  /** Attach email/password to the current guest (same user id, keeps cloud data). */
  saveGuestAccount: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    async function bootstrap() {
      if (!isConfigured) {
        if (mounted) {
          setSession(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const current = await authService.getCurrentSession();
        if (mounted) {
          setSession(current);
        }

        const supabase = getSupabaseClient();
        const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (mounted) {
            setSession(nextSession);
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
      } catch {
        if (mounted) {
          setSession(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [isConfigured]);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await authService.signInWithPassword(email, password);
    setSession(next);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await authService.signUpWithPassword(email, password);
    setSession(result.session);
    return { needsEmailConfirmation: result.needsEmailConfirmation };
  }, []);

  const continueAsGuest = useCallback(async () => {
    if (session) return;
    const next = await authService.signInAnonymously();
    setSession(next);
  }, [session]);

  const saveGuestAccount = useCallback(async (email: string, password: string) => {
    await authService.convertAnonymousToEmail(email, password);
    const next = await authService.getCurrentSession();
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
  }, []);

  const isAnonymous = authService.isAnonymousUser(session?.user);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isConfigured,
      isAnonymous,
      signIn,
      signUp,
      continueAsGuest,
      saveGuestAccount,
      signOut,
    }),
    [
      session,
      isLoading,
      isConfigured,
      isAnonymous,
      signIn,
      signUp,
      continueAsGuest,
      saveGuestAccount,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
