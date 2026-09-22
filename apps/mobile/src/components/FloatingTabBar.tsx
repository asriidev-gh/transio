import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { radii, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

export const FLOATING_TAB_BAR_CONTENT_INSET = 124;

type TabKey = 'index' | 'favorites' | 'settings';
type TabIcon = Extract<AppIconName, 'home-outline' | 'star-outline' | 'cog-outline'>;
type CaptureMode = 'record' | 'import';

const TABS: Array<{ key: TabKey; label: string; icon: TabIcon; href: Href }> = [
  { key: 'index', label: 'Home', icon: 'home-outline', href: '/(app)/(tabs)' },
  { key: 'favorites', label: 'Favorites', icon: 'star-outline', href: '/(app)/(tabs)/favorites' },
  { key: 'settings', label: 'Settings', icon: 'cog-outline', href: '/(app)/(tabs)/settings' },
];

function hrefForCapture(mode: CaptureMode): string {
  return mode === 'record' ? '/new-session?mode=record' : '/new-session?mode=import';
}

function activeTabFromPath(pathname: string): TabKey | null {
  if (pathname.includes('favorites')) return 'favorites';
  if (pathname.includes('settings')) return 'settings';
  if (
    pathname.includes('/session') ||
    pathname.includes('/folder') ||
    pathname.includes('/new-session') ||
    pathname.includes('/recording')
  ) {
    return null;
  }
  return 'index';
}

/** Persistent bottom menu for the signed-in app shell. */
export function FloatingTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { colors, shadows, scheme } = useTheme();
  const bottomPad = Math.max(insets.bottom, spacing.sm);
  const focused = activeTabFromPath(pathname);

  const glassBg =
    scheme === 'light' ? 'rgba(247, 245, 238, 0.94)' : 'rgba(37, 59, 71, 0.94)';
  const glassBorder =
    scheme === 'light' ? 'rgba(214, 209, 194, 0.7)' : 'rgba(110, 139, 151, 0.45)';

  function openCapture(mode: CaptureMode) {
    router.push(hrefForCapture(mode) as Href);
  }

  function goTab(tab: (typeof TABS)[number]) {
    if (focused === tab.key) {
      router.replace(tab.href);
      return;
    }
    router.push(tab.href);
  }

  function renderNavTab(tab: (typeof TABS)[number]) {
    const isFocused = focused === tab.key;
    return (
      <Pressable
        key={tab.key}
        style={({ pressed }) => [
          styles.tab,
          isFocused && [styles.tabActive, { backgroundColor: colors.accentSoft }],
          pressed && !isFocused && styles.pressed,
        ]}
        onPress={() => goTab(tab)}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={tab.label}
      >
        <Icon name={tab.icon} size={24} color={isFocused ? colors.accent : colors.inkMuted} />
        <Text
          style={[
            styles.label,
            { color: isFocused ? colors.ink : colors.inkMuted },
            isFocused && styles.labelActive,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: bottomPad },
        Platform.OS === 'web' ? ({ position: 'fixed' } as object) : null,
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          shadows.float,
          {
            backgroundColor: glassBg,
            borderColor: glassBorder,
          },
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              } as const)
            : null,
        ]}
      >
        <View style={styles.side}>
          {renderNavTab(TABS[0])}
          {renderNavTab(TABS[1])}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.centerBtn,
            shadows.emboss,
            {
              backgroundColor: scheme === 'light' ? '#FFFFFF' : colors.accent,
              borderColor: scheme === 'light' ? colors.border : colors.background,
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
          onPress={() => openCapture('record')}
          accessibilityRole="button"
          accessibilityLabel="Start recording"
        >
          <Icon name="microphone" size={30} />
        </Pressable>

        <View style={styles.side}>
          <Pressable
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            onPress={() => openCapture('import')}
            accessibilityRole="button"
            accessibilityLabel="Import audio or video"
          >
            <Icon name="download-outline" size={24} color={colors.inkMuted} />
            <Text style={[styles.label, { color: colors.inkMuted }]} numberOfLines={1}>
              Import
            </Text>
          </Pressable>
          {renderNavTab(TABS[2])}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: 64,
    width: '100%',
    maxWidth: 440,
    borderWidth: StyleSheet.hairlineWidth,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    minWidth: 0,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
    flexShrink: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  tabActive: {
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '700',
  },
  centerBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
