import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { radii, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface SkeletonBlockProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Soft pulsing placeholder bar. */
export function SkeletonBlock({
  width = '100%',
  height = 14,
  radius = radii.sm,
  style,
}: SkeletonBlockProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Session list row placeholders. */
export function SessionListSkeleton({ rows = 5 }: { rows?: number }) {
  const { colors, shadows } = useTheme();
  return (
    <View style={styles.list} accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.soft,
          ]}
        >
          <SkeletonBlock width={44} height={44} radius={radii.md} />
          <View style={styles.rowBody}>
            <SkeletonBlock width="72%" height={16} />
            <SkeletonBlock width="44%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Session workspace content placeholders. */
export function SessionContentSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.content, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel="Loading session content"
    >
      <SkeletonBlock width="38%" height={12} />
      <SkeletonBlock width="92%" height={18} />
      <SkeletonBlock width="88%" height={18} />
      <SkeletonBlock width="76%" height={18} />
      <View style={styles.gap} />
      <SkeletonBlock width="30%" height={12} />
      <SkeletonBlock width="95%" height={16} />
      <SkeletonBlock width="84%" height={16} />
      <SkeletonBlock width="90%" height={16} />
    </View>
  );
}

/** Home library placeholders (greeting + recent rows). */
export function HomeLibrarySkeleton() {
  return (
    <View style={styles.home} accessibilityLabel="Loading your library">
      <SkeletonBlock width="48%" height={28} radius={radii.md} />
      <SkeletonBlock width="64%" height={14} />
      <View style={styles.gap} />
      <SkeletonBlock width="100%" height={56} radius={radii.card} />
      <View style={styles.gap} />
      <SessionListSkeleton rows={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: spacing.sm,
  },
  content: {
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  gap: {
    height: spacing.sm,
  },
  home: {
    gap: spacing.sm,
  },
});
