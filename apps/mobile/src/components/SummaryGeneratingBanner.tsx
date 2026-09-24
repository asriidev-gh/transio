import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

/**
 * Compact status while an AI summary is writing.
 * Sits with the notes so the page stays readable.
 */
export function SummaryGeneratingBanner() {
  const { colors, reduceMotion } = useTheme();
  const travel = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      travel.value = 0.45;
      return;
    }
    travel.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(travel);
  }, [reduceMotion, travel]);

  const fillStyle = useAnimatedStyle(() => ({
    left: `${travel.value * 68}%`,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Writing your AI summary"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.ink }]}>Writing your AI summary</Text>
      <Text style={[styles.detail, { color: colors.inkMuted }]}>
        You can keep reading your notes. This usually takes a moment.
      </Text>
      <View style={[styles.track, { backgroundColor: colors.accentSoft }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.accent }, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    ...typography.meta,
    fontWeight: '700',
  },
  detail: {
    ...typography.caption,
    fontWeight: '500',
  },
  track: {
    height: 4,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  fill: {
    position: 'absolute',
    top: 0,
    width: '32%',
    height: 4,
    borderRadius: radii.pill,
  },
});
