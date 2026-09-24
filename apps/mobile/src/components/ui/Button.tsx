import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, radii, sizes, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Default true — set false for inline row actions (e.g. Add folder). */
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

/**
 * Shared CTA. Height lives on the fill (gradient / solid), not only the Pressable —
 * Android LinearGradient + flex rows otherwise collapse primary buttons to a thin strip.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, shadows } = useTheme();
  const idle = disabled || loading;

  const textColor =
    variant === 'primary' || variant === 'danger' ? colors.onBrand : colors.ink;

  const solidBg =
    variant === 'danger'
      ? colors.danger
      : variant === 'ghost'
        ? 'transparent'
        : colors.surface;

  const borderColor =
    variant === 'primary' || variant === 'danger' ? 'transparent' : colors.border;

  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
      {label}
    </Text>
  );

  const fillStyle = [styles.fill, fullWidth ? styles.fillFull : styles.fillInline];

  return (
    <Pressable
      onPress={onPress}
      disabled={idle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.pressable,
        fullWidth ? styles.pressableFull : styles.pressableInline,
        variant === 'primary' ? shadows.emboss : shadows.soft,
        {
          borderColor,
          opacity: idle ? 0.45 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed && !idle ? 0.98 : 1 }],
        },
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[...gradients.primary]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={fillStyle}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[fillStyle, { backgroundColor: solidBg }]}>{content}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pressableFull: {
    width: '100%',
    alignSelf: 'stretch',
  },
  pressableInline: {
    alignSelf: 'center',
    flexGrow: 0,
    flexShrink: 0,
  },
  fill: {
    height: sizes.button,
    minHeight: sizes.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  fillFull: {
    width: '100%',
  },
  fillInline: {
    minWidth: 72,
    paddingHorizontal: spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
