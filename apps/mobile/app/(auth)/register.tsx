import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { AuthServiceError } from '@/src/services/auth';
import { validateAuthForm } from '@/src/utils/auth-errors';
import { colors, spacing, typography } from '@/src/theme';

export default function RegisterScreen() {
  const { signUp, isConfigured } = useAuth();
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.brand} accessibilityRole="header">
          SessionAI
        </Text>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start saving and summarizing your sessions.</Text>

        {!isConfigured ? (
          <Text style={styles.configWarning} accessibilityRole="alert">
            Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and
            EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env, then restart Expo.
          </Text>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor={colors.inkMuted}
            editable={!loading}
            accessibilityLabel="Email"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="At least 8 characters"
            placeholderTextColor={colors.inkMuted}
            editable={!loading}
            accessibilityLabel="Password"
            onSubmitEditing={() => void onSubmit()}
          />
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {info ? (
          <Text style={styles.info} accessibilityRole="text">
            {info}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (loading || !isConfigured) && styles.buttonDisabled,
            pressed && !loading && isConfigured && styles.buttonPressed,
          ]}
          onPress={() => void onSubmit()}
          disabled={loading || !isConfigured}
          accessibilityRole="button"
          accessibilityLabel="Create Account"
        >
          <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Create Account'}</Text>
        </Pressable>

        <Link href="/(auth)/login" style={styles.link} accessibilityRole="link">
          Already have an account? Sign In
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  brand: {
    ...typography.brand,
    fontSize: 32,
    color: colors.brand,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  subtitle: {
    ...typography.body,
    color: colors.inkMuted,
    marginBottom: spacing.sm,
  },
  configWarning: {
    ...typography.caption,
    color: colors.danger,
    backgroundColor: colors.backgroundAlt,
    padding: spacing.md,
    borderRadius: 10,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    ...typography.body,
    fontSize: 14,
  },
  info: {
    color: colors.success,
    ...typography.body,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  link: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 16,
    marginTop: spacing.sm,
  },
});
