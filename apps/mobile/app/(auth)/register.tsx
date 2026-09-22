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
import { BrandLogo } from '@/src/components/BrandLogo';
import { Button } from '@/src/components/ui/Button';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

export default function RegisterScreen() {
  const { signUp, isConfigured } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    const validationError = validateAuthForm(email, password);
    if (validationError) {
      setError(validationError);
      setInfo(null);
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await signUp(email, password);
      if (result.needsEmailConfirmation) {
        setInfo('Account created. Check your email to confirm, then sign in.');
      }
    } catch (err) {
      const message =
        err instanceof AuthServiceError
          ? err.message
          : 'Unable to create your account. Check your connection and try again.';
      setError(message);
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
          <BrandLogo size={88} />
          <Text style={[styles.brand, { color: colors.ink }]} accessibilityRole="header">
            Smart Transcriber
          </Text>
          <Text style={[styles.title, { color: colors.ink }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
            Start saving and summarizing your sessions.
          </Text>

          {!isConfigured ? (
            <Text
              style={[styles.configWarning, { color: colors.danger, backgroundColor: colors.actionRecord }]}
              accessibilityRole="alert"
            >
              Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and
              EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env, then restart Expo.
            </Text>
          ) : null}

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.inkMuted }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
              ]}
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
              style={[
                styles.input,
                { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
              ]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="At least 8 characters"
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
          {info ? (
            <Text style={[styles.info, { color: colors.success }]} accessibilityRole="text">
              {info}
            </Text>
          ) : null}

          <Button
            label={loading ? 'Creating…' : 'Create account'}
            onPress={() => void onSubmit()}
            disabled={loading || !isConfigured}
            loading={loading}
            accessibilityLabel="Create account"
          />

          <Link href="/(auth)/login" style={[styles.link, { color: colors.accent }]} accessibilityRole="link">
            Already have an account? Sign in
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
  },
  brand: {
    ...typography.brand,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.sm,
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
  info: {
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
