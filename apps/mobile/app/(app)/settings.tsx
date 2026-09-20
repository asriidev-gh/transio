import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/src/hooks/useAuth';
import { AuthServiceError } from '@/src/services/auth';
import { colors, spacing, typography } from '@/src/theme';
import { mobileEnv, isSupabaseConfigured } from '@/src/lib/env';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
    } catch (err) {
      setError(err instanceof AuthServiceError ? err.message : 'Could not sign out.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.body}>Manage your SessionAI account and connection settings.</Text>

      <View style={styles.block}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.email ?? 'Unknown'}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>API base URL</Text>
        <Text style={styles.value}>{mobileEnv.apiBaseUrl}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Supabase</Text>
        <Text style={styles.value}>
          {isSupabaseConfigured()
            ? 'Public URL and anon key are set'
            : 'Not configured — see .env.example'}
        </Text>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          signingOut && styles.buttonDisabled,
          pressed && !signingOut && styles.buttonPressed,
        ]}
        onPress={() => void onSignOut()}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.buttonText}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },
  block: {
    gap: 4,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    ...typography.body,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    ...typography.caption,
  },
  button: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
