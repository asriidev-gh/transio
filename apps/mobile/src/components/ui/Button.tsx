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
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, shadows } = useTheme();
  const idle = disabled || loading;

  // Secondary/ghost always get a solid surface so they read as real controls on soft canvases.
  const background =
    variant === 'danger'
      ? colors.danger
      : variant === 'primary'
        ? 'transparent'
        : colors.surface;

  const borderColor =
    variant === 'primary' || variant === 'danger' ? 'transparent' : colors.border;

  const textColor =
    variant === 'primary' || variant === 'danger' ? colors.onBrand : colors.ink;

  const elevate = variant === 'primary' || variant === 'secondary' || variant === 'ghost';

  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <Text style={[styles.label, { color: textColor }]}>{label}</Text>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={idle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        elevate && variant !== 'primary' ? shadows.soft : null,
        variant === 'primary' ? shadows.emboss : null,
        {
          backgroundColor: background,
          borderColor,
          opacity: idle ? 0.45 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed && !idle ? 0.98 : 1 }],
          overflow: 'hidden',
        },
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[...gradients.primary]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradientFill}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={styles.plainFill}>{content}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.button,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  gradientFill: {
    flex: 1,
    minHeight: sizes.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  plainFill: {
    flex: 1,
    minHeight: sizes.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
});
