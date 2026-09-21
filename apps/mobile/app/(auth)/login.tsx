import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/hooks/useAuth';
import { AuthServiceError } from '@/src/services/auth';
import { validateAuthForm } from '@/src/utils/auth-errors';
import { Button } from '@/src/components/ui/Button';
import { BrandLogo } from '@/src/components/BrandLogo';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

export default function LoginScreen() {
  const { signIn, isConfigured } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    const validationError = validateAuthForm(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(
        err instanceof AuthServiceError
          ? err.message
          : 'Unable to sign in. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <BrandLogo size={112} />
          <Text style={[styles.brand, { color: colors.ink }]} accessibilityRole="header">
            Transio
          </Text>
          <Text style={[styles.headline, { color: colors.ink }]}>Transcribe every seminar</Text>
          <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
            Record discussions, leave while we process, then ask and act.
          </Text>

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
              autoComplete="password"
              textContentType="password"
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
            label={loading ? 'Signing in…' : 'Continue with email'}
            onPress={() => void onSubmit()}
            disabled={loading || !isConfigured}
            loading={loading}
            accessibilityLabel="Continue with email"
          />

          <Link href="/(auth)/register" style={[styles.link, { color: colors.ink }]} accessibilityRole="link">
            Create account
          </Link>
        </View>
      </KeyboardAvoidingView>
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
  brand: {
    ...typography.brand,
  },
  headline: {
    ...typography.pageTitle,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.sm,
    maxWidth: 320,
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
  link: {
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
