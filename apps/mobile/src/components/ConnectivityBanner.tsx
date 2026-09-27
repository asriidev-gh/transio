import { StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface ConnectivityBannerProps {
  /** Shown only after silent retries have failed. */
  visible: boolean;
}

export function ConnectivityBanner({ visible }: ConnectivityBannerProps) {
  const { colors } = useTheme();
  if (!visible) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}
      accessibilityRole="text"
    >
      <Text style={[styles.text, { color: colors.ink }]}>
        The API is currently experiencing high traffic. We’re resolving this as soon as we can.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    ...typography.meta,
    fontWeight: '600',
  },
});
