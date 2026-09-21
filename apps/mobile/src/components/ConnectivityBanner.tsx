import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface ConnectivityBannerProps {
  reachable: boolean | null;
  onRetry?: () => void;
}

export function ConnectivityBanner({ reachable, onRetry }: ConnectivityBannerProps) {
  const { colors } = useTheme();
  if (reachable !== false) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.actionRecord, borderColor: colors.danger }]}
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: colors.danger }]}>
        Can’t reach the SessionAI API. Check your connection.
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry connection">
          <Text style={[styles.retry, { color: colors.ink }]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  text: {
    ...typography.meta,
    flex: 1,
    fontWeight: '600',
  },
  retry: {
    ...typography.meta,
    fontWeight: '700',
  },
});
