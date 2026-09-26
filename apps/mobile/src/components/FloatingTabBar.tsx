import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlossOrb } from '@/src/components/ui/GlossOrb';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { radii, sizes, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

/** Extra bottom padding so content clears the floating dock + Record FAB. */
export const FLOATING_TAB_BAR_CONTENT_INSET = 120;

/** True on primary tab screens where the dock should stay visible. */
export function isFloatingTabBarRoute(pathname: string): boolean {
  if (
    pathname.includes('/session') ||
    pathname.includes('/folder') ||
    pathname.includes('/new-session') ||
    pathname.includes('/recording') ||
    pathname.includes('/help') ||
    pathname.includes('/about') ||
    pathname.includes('/privacy') ||
    pathname.includes('/terms') ||
    pathname.includes('/voice-translate') ||
    pathname.includes('/paywall')
  ) {
    return false;
  }
  return true;
}

/** Bottom padding for scroll content — docks on tabs, compact on detail flows. */
export function useFloatingTabBarContentInset(): number {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  if (!isFloatingTabBarRoute(pathname)) {
    return Math.max(insets.bottom, spacing.md) + spacing.lg;
  }
  return FLOATING_TAB_BAR_CONTENT_INSET;
}

type SideTabKey = 'index' | 'history' | 'translate' | 'settings';
type TabIcon = Extract<
  AppIconName,
  'home-outline' | 'file-music-outline' | 'translate' | 'cog-outline'
>;

const LEFT_TABS: Array<{ key: SideTabKey; label: string; icon: TabIcon; href: Href }> = [
  { key: 'index', label: 'Home', icon: 'home-outline', href: '/(app)/(tabs)' },
  {
    key: 'history',
    label: 'History',
    icon: 'file-music-outline',
    href: '/(app)/(tabs)/history',
  },
];

const RIGHT_TABS: Array<{ key: SideTabKey; label: string; icon: TabIcon; href: Href }> = [
  {
    key: 'translate',
    label: 'Translate',
    icon: 'translate',
    href: '/(app)/(tabs)/translate',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'cog-outline',
    href: '/(app)/(tabs)/settings',
  },
];

function activeTabFromPath(pathname: string): SideTabKey | null {
  if (pathname.includes('history') || pathname.includes('favorites')) return 'history';
  if (pathname.includes('translate') && pathname.includes('(tabs)')) return 'translate';
  if (pathname.includes('settings')) return 'settings';
  if (
    pathname.includes('/session') ||
    pathname.includes('/folder') ||
    pathname.includes('/new-session') ||
    pathname.includes('/recording') ||
    pathname.includes('/help') ||
    pathname.includes('/about') ||
    pathname.includes('/privacy') ||
    pathname.includes('/terms') ||
    pathname.includes('/voice-translate')
  ) {
    return null;
  }
  return 'index';
}

function SideTab({
  tab,
  focused,
  onPress,
}: {
  tab: (typeof LEFT_TABS)[number];
  focused: boolean;
  onPress: () => void;
}) {
  const ink = focused ? '#FFFFFF' : 'rgba(255,255,255,0.55)';
  return (
    <Pressable
      style={({ pressed }) => [styles.tab, pressed && !focused && styles.pressed]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tab.label}
    >
      <View style={styles.tabInner}>
        <Icon name={tab.icon} size={22} color={ink} variant="line" />
        <Text style={[styles.tabLabel, { color: ink }]}>{tab.label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Dark floating pill nav + raised candy-glass Record FAB (gloss + glare).
 */
export function FloatingTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { shadows } = useTheme();
  const bottomPad = Math.max(insets.bottom, spacing.sm);
  const focused = activeTabFromPath(pathname);

  if (!isFloatingTabBarRoute(pathname)) {
    return null;
  }

  function goTab(tab: (typeof LEFT_TABS)[number]) {
    if (focused === tab.key) {
      router.replace(tab.href);
      return;
    }
    router.push(tab.href);
  }

  function onRecord() {
    router.push('/new-session?mode=record' as Href);
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.dock}>
        <View
          style={[
            styles.bar,
            shadows.float,
            {
              backgroundColor: 'rgba(15, 23, 42, 0.72)',
              borderColor: 'rgba(255, 255, 255, 0.12)',
            },
          ]}
        >
          {LEFT_TABS.map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              focused={focused === tab.key}
              onPress={() => goTab(tab)}
            />
          ))}

          <View style={styles.fabSlot} />

          {RIGHT_TABS.map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              focused={focused === tab.key}
              onPress={() => goTab(tab)}
            />
          ))}
        </View>

        <Pressable
          onPress={onRecord}
          style={({ pressed }) => [
            styles.fabWrap,
            { transform: [{ scale: pressed ? 0.94 : 1 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Record"
        >
          <GlossOrb size={FAB} halo>
            <Icon name="microphone" size={26} color="#FFFFFF" variant="line" />
          </GlossOrb>
        </Pressable>
      </View>
    </View>
  );
}

const FAB = sizes.record;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    zIndex: 40,
  },
  dock: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 62,
    overflow: 'hidden',
    zIndex: 1,
    ...Platform.select({
      web: { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as object,
      default: {},
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  tabInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    minWidth: 52,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  fabSlot: {
    width: FAB + 8,
  },
  fabWrap: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 14,
    width: FAB + 28,
    height: FAB + 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
