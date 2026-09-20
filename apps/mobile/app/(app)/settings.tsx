import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '@/src/hooks/useAuth';
import { AuthServiceError } from '@/src/services/auth';
import {
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/src/services/notifications';
import { colors, radii, spacing, typography } from '@/src/theme';
import { mobileEnv, isSupabaseConfigured } from '@/src/lib/env';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [requestingNotif, setRequestingNotif] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? '0.1.0';

  useEffect(() => {
    void getNotificationPermission().then(setNotifPermission);
  }, []);

  function onSignOut() {
    Alert.alert('Sign out?', 'You can sign back in anytime with the same account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSigningOut(true);
            setError(null);
            try {
              await signOut();
            } catch (err) {
              setError(err instanceof AuthServiceError ? err.message : 'Could not sign out.');
            } finally {
              setSigningOut(false);
            }
          })();
        },
      },
    ]);
  }

  async function onEnableNotifications() {
    setRequestingNotif(true);
    setError(null);
    try {
      const next = await requestNotificationPermission();
      setNotifPermission(next);
      if (next === 'denied') {
        setError('Notifications are blocked in the browser. Enable them in site settings.');
      } else if (next === 'unsupported') {
        setError('This browser does not support notifications.');
      }
    } finally {
      setRequestingNotif(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Settings
      </Text>
      <Text style={styles.body}>Account, connection, and app details for SessionAI.</Text>

      <View style={styles.block}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.email ?? 'Unknown'}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>App version</Text>
        <Text style={styles.value}>{appVersion}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>API base URL</Text>
        <Text style={[styles.value, styles.mono]}>{mobileEnv.apiBaseUrl}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Supabase</Text>
        <Text style={styles.value}>
          {isSupabaseConfigured()
            ? 'Public URL and anon key are set'
            : 'Not configured — see .env.example'}
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Processing notifications</Text>
        <Text style={styles.value}>
          {notifPermission === 'granted'
            ? 'Enabled — you’ll get a browser alert when processing finishes.'
            : notifPermission === 'denied'
              ? 'Blocked in the browser.'
              : notifPermission === 'unsupported'
                ? 'Not available in this environment.'
                : 'Optional — useful when you leave during processing.'}
        </Text>
        {notifPermission !== 'granted' && notifPermission !== 'unsupported' ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void onEnableNotifications()}
            disabled={requestingNotif}
            accessibilityRole="button"
            accessibilityLabel="Enable processing notifications"
          >
            <Text style={styles.secondaryButtonText}>
              {requestingNotif ? 'Requesting…' : 'Enable notifications'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>About</Text>
        <Text style={styles.value}>
          SessionAI records seminars and discussions, then transcribes and summarizes them with
          server-side AI. Secrets never leave the API.
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
        onPress={onSignOut}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.buttonText}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  mono: {
    ...typography.mono,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    ...typography.caption,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 14,
  },
  button: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: colors.onBrand,
    fontWeight: '600',
    fontSize: 16,
  },
});
