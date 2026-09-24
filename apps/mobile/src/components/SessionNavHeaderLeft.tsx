import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface SessionNavHeaderLeftProps {
  /** When omitted, uses router.back() with home fallback. */
  onBack?: () => void;
}

/**
 * Back + Home controls for session detail headers.
 */
export function SessionNavHeaderLeft({ onBack }: SessionNavHeaderLeftProps) {
  const router = useRouter();
  const { colors } = useTheme();

  function goBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function goHome() {
    router.replace('/');
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={goBack}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={styles.backGlyph}>
          <Icon name="chevron-right" size={22} color={colors.ink} variant="line" />
        </View>
      </Pressable>
      <Pressable
        onPress={goHome}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Go home"
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Icon name="home-outline" size={22} color={colors.ink} variant="line" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.xs,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    transform: [{ scaleX: -1 }],
  },
});
