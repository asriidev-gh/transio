import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radii, sizes, spacing } from '@/src/theme';
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

  const background =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surface
          : 'transparent';
  const borderColor =
    variant === 'secondary' || variant === 'ghost' ? colors.border : background;
  const textColor =
    variant === 'primary' || variant === 'danger' ? colors.onBrand : colors.ink;
  const elevate = variant === 'primary' || variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      disabled={idle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        elevate ? shadows.float : null,
        {
          backgroundColor: background,
          borderColor,
          opacity: idle ? 0.45 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !idle ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.button,
    borderRadius: radii.pill,
    borderWidth: 1,
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
