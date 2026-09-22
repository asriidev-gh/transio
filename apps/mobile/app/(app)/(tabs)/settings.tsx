import { useEffect, useState, type ReactNode } from 'react';
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
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { radii, spacing, typography, type AppearancePreference } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { mobileEnv, isSupabaseConfigured } from '@/src/lib/env';
import { confirmAction, confirmDestructive } from '@/src/utils/confirm';

const APPEARANCE_OPTIONS: Array<{ key: AppearancePreference; label: string }> = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

function notificationStatusLabel(permission: NotificationPermission): string {
  switch (permission) {
    case 'granted':
      return 'Enabled';
    case 'denied':
      return 'Blocked';
    case 'unsupported':
      return 'Unavailable';
    default:
      return 'Off';
  }
}

interface SettingsRowProps {
  icon: AppIconName;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  last?: boolean;
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  showChevron,
  destructive,
  last,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const chevron = showChevron ?? Boolean(onPress);
  const ink = destructive ? colors.danger : colors.ink;
  const content = (
    <>
      <View style={styles.rowInner}>
        <Icon name={icon} size={20} color={ink} variant="line" />
        <Text style={[styles.rowLabel, { color: ink }]} numberOfLines={1}>
          {label}
        </Text>
        {value ? (
          <Text style={[styles.rowTrailing, { color: colors.inkMuted }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {chevron ? <Icon name="chevron-right" size={18} color={colors.inkMuted} variant="line" /> : null}
      </View>
      {!last ? (
        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.72 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </Pressable>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { colors, shadows } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.inkMuted }]}>{title}</Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          shadows.soft,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { colors, preference, setPreference, scheme, shadows } = useTheme();
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
    if (notifPermission === 'granted' || notifPermission === 'unsupported') return;
    setRequestingNotif(true);
    setError(null);
    try {
      const next = await requestNotificationPermission();
      setNotifPermission(next);
      if (next === 'denied') {
        setError('Notifications are blocked. Enable them in system settings.');
      } else if (next === 'unsupported') {
        setError('This device does not support notifications.');
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
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
        Settings
      </Text>

      <SettingsGroup title="Account">
        <SettingsRow
          icon="account-outline"
          label="Signed in as"
          value={user?.email ?? 'Unknown'}
          last
        />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <View style={styles.appearanceBlock}>
          <View style={styles.appearanceHeader}>
            <Icon
              name={
                preference === 'dark'
                  ? 'moon-waning-crescent'
                  : preference === 'light'
                    ? 'white-balance-sunny'
                    : 'theme-light-dark'
              }
              size={20}
              color={colors.ink}
              variant="line"
            />
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Appearance</Text>
          </View>
          <View
            style={[
              styles.segment,
              { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
            ]}
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
          <Text style={[styles.hint, { color: colors.inkMuted }]}>
            {scheme === 'light'
              ? 'Light canvas matched to the brand lockup.'
              : 'Deep slate + mint matched to the dark lockup.'}
          </Text>
        </View>
        <View style={[styles.rowDividerFull, { backgroundColor: colors.border }]} />
        <SettingsRow
          icon="bell-outline"
          label={requestingNotif ? 'Requesting…' : 'Notifications'}
          value={notificationStatusLabel(notifPermission)}
          onPress={
            notifPermission !== 'granted' && notifPermission !== 'unsupported'
              ? () => void onEnableNotifications()
              : undefined
          }
          showChevron={notifPermission !== 'granted' && notifPermission !== 'unsupported'}
          last
        />
      </SettingsGroup>

      <SettingsGroup title="Connection">
        <SettingsRow icon="sine-wave" label="API" value={mobileEnv.apiBaseUrl} last={false} />
        <SettingsRow
          icon="lock"
          label="Supabase"
          value={isSupabaseConfigured() ? 'Configured' : 'Not configured'}
          last
        />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow icon="rocket" label="Version" value={appVersion} last={false} />
        <SettingsRow
          icon="bulb"
          label="Replay onboarding"
          onPress={onReplayOnboarding}
          last
        />
      </SettingsGroup>

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={onSignOut}
        disabled={signingOut}
        style={({ pressed }) => [
          styles.signOut,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: signingOut ? 0.5 : pressed ? 0.85 : 1,
          },
          shadows.soft,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Icon name="logout" size={20} color={colors.danger} variant="line" />
        <Text style={[styles.signOutLabel, { color: colors.danger }]}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: FLOATING_TAB_BAR_CONTENT_INSET,
    gap: spacing.lgSoft,
  },
  title: {
    ...typography.pageTitle,
    marginBottom: spacing.xs,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    justifyContent: 'center',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smd,
    minHeight: 52,
  },
  rowLabel: {
    ...typography.body,
    fontWeight: '600',
    flexShrink: 1,
    flexGrow: 1,
  },
  rowTrailing: {
    ...typography.caption,
    fontWeight: '600',
    maxWidth: '46%',
    textAlign: 'right',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md + 20 + spacing.smd,
    marginRight: spacing.md,
  },
  rowDividerFull: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
    marginRight: spacing.md,
  },
  appearanceBlock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.smd,
    gap: spacing.sm,
  },
  appearanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
  },
  hint: {
    ...typography.caption,
    lineHeight: 18,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
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
    paddingHorizontal: spacing.xs,
  },
  signOut: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signOutLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
