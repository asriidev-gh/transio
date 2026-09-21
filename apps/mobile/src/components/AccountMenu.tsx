import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/hooks/useAuth';
import { AuthServiceError } from '@/src/services/auth';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmDestructive, showAlert } from '@/src/utils/confirm';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

interface NavItem {
  key: string;
  label: string;
  icon: AppIconName;
  href: Href;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'favorites', label: 'Favorites', icon: 'star-outline', href: '/(app)/(tabs)/favorites' },
  { key: 'settings', label: 'Settings', icon: 'cog-outline', href: '/(app)/(tabs)/settings' },
];

/** Top-right account control — opens a compact nav sheet with sign out. */
export function AccountMenu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { colors, shadows } = useTheme();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const email = user?.email ?? 'Account';
  const firstName = user?.email?.split('@')[0];
  const greeting = `${greetingForHour(new Date().getHours())}${firstName ? `, ${firstName}` : ''}`;

  function close() {
    setOpen(false);
  }

  function go(href: Href) {
    close();
    router.push(href);
  }

  function onSignOut() {
    void (async () => {
      const ok = await confirmDestructive(
        'Sign out?',
        'You can sign back in anytime with the same account.',
        'Sign Out',
      );
      if (!ok) return;
      setSigningOut(true);
      try {
        close();
        await signOut();
      } catch (err) {
        await showAlert(
          'Could not sign out',
          err instanceof AuthServiceError ? err.message : 'Try again in a moment.',
        );
      } finally {
        setSigningOut(false);
      }
    })();
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Account menu"
        style={({ pressed }) => [
          styles.avatar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
          shadows.soft,
        ]}
      >
        <Icon name="account-outline" size={28} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.frame}>
          <Pressable
            style={[styles.backdrop, { backgroundColor: colors.overlay }]}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close account menu"
          />
          <View
            style={[
              styles.menuWrap,
              { top: insets.top + spacing.sm, paddingRight: spacing.lg },
            ]}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.menu,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                shadows.float,
              ]}
            >
              <View style={styles.header}>
                <Text style={[styles.greeting, { color: colors.ink }]} numberOfLines={1}>
                  {greeting}
                </Text>
                <Text style={[styles.email, { color: colors.inkMuted }]} numberOfLines={1}>
                  {email}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {NAV_ITEMS.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => go(item.href)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: colors.accentSoft },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Icon name={item.icon} size={24} />
                  <Text style={[styles.rowLabel, { color: colors.ink }]}>{item.label}</Text>
                  <Icon name="chevron-right" size={16} color={colors.inkMuted} />
                </Pressable>
              ))}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <Pressable
                onPress={onSignOut}
                disabled={signingOut}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.accentSoft },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Icon name="logout" size={22} color={colors.danger} />
                <Text style={[styles.rowLabel, { color: colors.danger }]}>
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  menuWrap: {
    position: 'absolute',
    right: 0,
    left: 0,
    alignItems: 'flex-end',
  },
  menu: {
    width: 260,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  greeting: {
    ...typography.section,
  },
  email: {
    ...typography.caption,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smd,
    minHeight: 48,
  },
  rowLabel: {
    ...typography.body,
    flex: 1,
  },
});
