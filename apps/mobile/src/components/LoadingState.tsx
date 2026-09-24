import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BrandLogo } from '@/src/components/BrandLogo';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface LoadingStateProps {
  message?: string;
  /** Optional second line under the title. */
  detail?: string;
}

const BAR_COUNT = 5;
const BAR_BASE = [0.35, 0.55, 0.85, 0.55, 0.35];

function PulseRing({
  color,
  size,
  delayMs,
  reduceMotion,
}: {
  color: string;
  size: number;
  delayMs: number;
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0;
      return;
    }
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [delayMs, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - progress.value),
    transform: [{ scale: 0.72 + progress.value * 0.55 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

function EqualizerBar({
  index,
  color,
  reduceMotion,
}: {
  index: number;
  color: string;
  reduceMotion: boolean;
}) {
  const scaleY = useSharedValue(BAR_BASE[index] ?? 0.4);

  useEffect(() => {
    if (reduceMotion) {
      scaleY.value = BAR_BASE[index] ?? 0.4;
      return;
    }
    const peak = 0.35 + ((index * 17) % 5) * 0.12;
    scaleY.value = withDelay(
      index * 90,
      withRepeat(
        withSequence(
          withTiming(0.95, { duration: 320 + index * 40, easing: Easing.inOut(Easing.quad) }),
          withTiming(peak, { duration: 360 + index * 30, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(scaleY);
  }, [index, reduceMotion, scaleY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.max(0.22, scaleY.value) }],
  }));

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: color }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/**
 * Centered page loader — brand mark, soft pulse rings, and a voice equalizer.
 * Drop into a flex:1 parent (or rely on minHeight) for full-screen presence.
 */
export function LoadingState({
  message = 'Preparing…',
  detail = 'Just a moment',
}: LoadingStateProps) {
  const { colors, reduceMotion } = useTheme();

  return (
    <View
      style={styles.container}
      accessibilityLabel={message}
      accessibilityRole="progressbar"
    >
      <View style={styles.hero}>
        <PulseRing color={colors.brand} size={148} delayMs={0} reduceMotion={reduceMotion} />
        <PulseRing color={colors.cyan} size={148} delayMs={600} reduceMotion={reduceMotion} />
        <View
          style={[
            styles.markWell,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <BrandLogo variant="mark" size={52} accessibilityLabel="Smart Transcriber" />
        </View>
      </View>

      <View style={styles.equalizer} accessibilityElementsHidden importantForAccessibility="no">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <EqualizerBar key={i} index={i} color={colors.brand} reduceMotion={reduceMotion} />
        ))}
      </View>

      <View style={styles.copy}>
        <Text style={[styles.message, { color: colors.ink }]}>{message}</Text>
        {detail ? (
          <Text style={[styles.detail, { color: colors.inkMuted }]}>{detail}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    minHeight: 280,
  },
  hero: {
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  markWell: {
    width: 88,
    height: 88,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equalizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    height: 28,
    marginTop: spacing.xs,
  },
  bar: {
    width: 5,
    height: 28,
    borderRadius: 3,
    opacity: 0.9,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    maxWidth: 280,
  },
  message: {
    ...typography.section,
    textAlign: 'center',
  },
  detail: {
    ...typography.caption,
    textAlign: 'center',
  },
});
