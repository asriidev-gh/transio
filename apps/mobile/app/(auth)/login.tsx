import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardSafeScrollView } from '@/src/components/KeyboardSafeScrollView';
import { useAuth } from '@/src/hooks/useAuth';
import { AuthServiceError } from '@/src/services/auth';
import { resetOnboarding } from '@/src/services/onboarding';
import { validateAuthForm } from '@/src/utils/auth-errors';
import { Button } from '@/src/components/ui/Button';
import { BrandLogo } from '@/src/components/BrandLogo';
import { APP_TAGLINE } from '@/src/data/brand';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmAction } from '@/src/utils/confirm';

export default function LoginScreen() {
  const { signIn, saveGuestAccount, isConfigured, isAnonymous, session } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Guest opened login to attach email; can switch to “existing account” sign-in. */
  const [existingAccount, setExistingAccount] = useState(false);

  const savingGuest = isAnonymous && !existingAccount;

  async function onCreateAccount() {
    await resetOnboarding();
    router.replace('/onboarding');
  }

  async function onSubmit() {
    const validationError = validateAuthForm(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (savingGuest) {
        await saveGuestAccount(email, password);
        router.replace('/');
        return;
      }

      if (isAnonymous) {
        const ok = await confirmAction(
          'Switch accounts?',
          'Signing in replaces this guest session. Recordings on this guest stay with the guest user id.',
          'Sign in',
        );
        if (!ok) return;
      }

      await signIn(email, password);
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof AuthServiceError
          ? err.message
          : 'Unable to continue. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardSafeScrollView
        style={styles.flex}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.container}>
          <View style={styles.brandBlock}>
            <BrandLogo size={248} />
            <Text style={[styles.headline, { color: colors.ink }]} accessibilityRole="header">
              {savingGuest ? 'Save your account' : APP_TAGLINE}
            </Text>
            <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
              {savingGuest
                ? 'Add email and password so you can restore this library on another device.'
                : 'Record discussions, leave while we process, then ask and act.'}
            </Text>
          </View>

          {!isConfigured ? (
            <Text style={[styles.configWarning, { color: colors.danger, backgroundColor: colors.actionRecord }]} accessibilityRole="alert">
              Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and
              EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env, then restart Expo.
            </Text>
          ) : null}

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.inkMuted }]}>Email</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink }]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              placeholderTextColor={colors.tertiary}
              editable={!loading}
              accessibilityLabel="Email"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.inkMuted }]}>Password</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={savingGuest ? 'new-password' : 'password'}
              textContentType={savingGuest ? 'newPassword' : 'password'}
              placeholder="••••••••"
              placeholderTextColor={colors.tertiary}
              editable={!loading}
              accessibilityLabel="Password"
              onSubmitEditing={() => void onSubmit()}
            />
          </View>

          {error ? (
            <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            label={
              loading
                ? savingGuest
                  ? 'Saving…'
                  : 'Signing in…'
                : savingGuest
                  ? 'Save account'
                  : 'Continue with email'
            }
            onPress={() => void onSubmit()}
            disabled={loading || !isConfigured}
            loading={loading}
            accessibilityLabel={savingGuest ? 'Save account' : 'Continue with email'}
          />

          {isAnonymous ? (
            <Pressable
              onPress={() => {
                setExistingAccount((v) => !v);
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                existingAccount ? 'Save this guest instead' : 'Use an existing account'
              }
              style={styles.linkHit}
            >
              <Text style={[styles.link, { color: colors.ink }]}>
                {existingAccount ? 'Save this guest instead' : 'Use an existing account'}
              </Text>
            </Pressable>
          ) : !session ? (
            <Pressable
              onPress={() => void onCreateAccount()}
              accessibilityRole="button"
              accessibilityLabel="Create account"
              style={styles.linkHit}
            >
              <Text style={[styles.link, { color: colors.ink }]}>Create account</Text>
            </Pressable>
          ) : null}

          {isAnonymous ? (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Not now"
              style={styles.linkHit}
            >
              <Text style={[styles.linkMuted, { color: colors.inkMuted }]}>Not now</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardSafeScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  headline: {
    ...typography.pageTitle,
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 28,
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.xs,
  },
  configWarning: {
    ...typography.caption,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    minHeight: 52,
  },
  error: {
    ...typography.body,
    fontSize: 14,
  },
  linkHit: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  link: {
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
  linkMuted: {
    fontWeight: '500',
    fontSize: 14,
    textAlign: 'center',
  },
});
