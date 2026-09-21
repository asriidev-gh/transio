import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { AuthServiceError } from '@/src/services/auth';
import {
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/src/services/notifications';
import { resetOnboarding } from '@/src/services/onboarding';
import { FLOATING_TAB_BAR_CONTENT_INSET } from '@/src/components/FloatingTabBar';
import { Button } from '@/src/components/ui/Button';
import { radii, spacing, typography, type AppearancePreference } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { mobileEnv, isSupabaseConfigured } from '@/src/lib/env';
import { confirmAction, confirmDestructive } from '@/src/utils/confirm';

const APPEARANCE_OPTIONS: Array<{ key: AppearancePreference; label: string }> = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { colors, preference, setPreference, scheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [requestingNotif, setRequestingNotif] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? '0.1.0';

  useEffect(() => {
    void getNotificationPermission().then(setNotifPermission);
  }, []);

  function onSignOut() {
    void (async () => {
      const ok = await confirmDestructive(
        'Sign out?',
        'You can sign back in anytime with the same account.',
        'Sign Out',
      );
      if (!ok) return;
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

  function onReplayOnboarding() {
    void (async () => {
      const ok = await confirmAction(
        'Replay onboarding?',
        'You’ll see the intro slides again on next launch.',
        'Replay',
      );
      if (!ok) return;
      await resetOnboarding();
      router.replace('/onboarding');
    })();
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
        Settings
      </Text>

      <Text style={[styles.group, { color: colors.inkMuted }]}>Account</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.rowLabel, { color: colors.inkMuted }]}>Signed in as</Text>
        <Text style={[styles.rowValue, { color: colors.ink }]}>{user?.email ?? 'Unknown'}</Text>
      </View>

      <Text style={[styles.group, { color: colors.inkMuted }]}>Appearance</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View
          style={[styles.segment, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
          accessibilityRole="tablist"
        >
          {APPEARANCE_OPTIONS.map((option) => {
            const selected = preference === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setPreference(option.key)}
                style={[
                  styles.segmentItem,
                  selected
                    ? { backgroundColor: colors.ink }
                    : { backgroundColor: 'transparent' },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: selected ? colors.onBrand : colors.inkMuted },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.rowLabel, { color: colors.inkMuted, marginTop: spacing.sm }]}>
          {scheme === 'light'
            ? 'Cream clay canvas — matched to the light lockup.'
            : 'Deep slate + mint — matched to the dark lockup.'}
        </Text>
      </View>

      <Text style={[styles.group, { color: colors.inkMuted }]}>Notifications</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.rowValue, { color: colors.ink }]}>
          {notifPermission === 'granted'
            ? 'Enabled when processing finishes.'
            : notifPermission === 'denied'
              ? 'Blocked in the browser.'
              : notifPermission === 'unsupported'
                ? 'Not available here.'
                : 'Optional — useful when you leave during processing.'}
        </Text>
        {notifPermission !== 'granted' && notifPermission !== 'unsupported' ? (
          <View style={styles.rowAction}>
            <Button
              label={requestingNotif ? 'Requesting…' : 'Enable notifications'}
              onPress={() => void onEnableNotifications()}
              variant="secondary"
              disabled={requestingNotif}
            />
          </View>
        ) : null}
      </View>

      <Text style={[styles.group, { color: colors.inkMuted }]}>Connection</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.rowLabel, { color: colors.inkMuted }]}>API</Text>
        <Text style={[styles.rowMono, { color: colors.ink }]}>{mobileEnv.apiBaseUrl}</Text>
        <Text style={[styles.rowLabel, { color: colors.inkMuted, marginTop: spacing.sm }]}>
          Supabase
        </Text>
        <Text style={[styles.rowValue, { color: colors.ink }]}>
          {isSupabaseConfigured() ? 'Configured' : 'Not configured — see .env.example'}
        </Text>
      </View>

      <Text style={[styles.group, { color: colors.inkMuted }]}>About</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.rowValue, { color: colors.ink }]}>
          Transio transcribes seminars and discussions on the server. Secrets never leave the API.
        </Text>
        <Text style={[styles.rowLabel, { color: colors.inkMuted, marginTop: spacing.sm }]}>
          Version {appVersion}
        </Text>
        <View style={styles.rowAction}>
          <Button label="Replay onboarding" onPress={onReplayOnboarding} variant="ghost" />
        </View>
      </View>

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Button
        label={signingOut ? 'Signing out…' : 'Sign out'}
        onPress={onSignOut}
        variant="danger"
        disabled={signingOut}
        loading={signingOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: FLOATING_TAB_BAR_CONTENT_INSET,
    gap: spacing.md,
  },
  title: {
    ...typography.pageTitle,
    marginBottom: spacing.sm,
  },
  group: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  rowLabel: {
    ...typography.caption,
  },
  rowValue: {
    ...typography.body,
  },
  rowMono: {
    ...typography.mono,
  },
  rowAction: {
    marginTop: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    ...typography.caption,
  },
});
