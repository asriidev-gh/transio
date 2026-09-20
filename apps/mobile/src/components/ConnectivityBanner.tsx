import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/src/theme';

interface ConnectivityBannerProps {
  reachable: boolean | null;
  onRetry?: () => void;
}

export function ConnectivityBanner({ reachable, onRetry }: ConnectivityBannerProps) {
  if (reachable !== false) {
    return null;
  }

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>Can't reach the SessionAI API. Check your connection.</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry connection">
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F8E8E4',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  text: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
    fontWeight: '600',
  },
  retry: {
    ...typography.caption,
    color: colors.brandSoft,
    fontWeight: '700',
  },
});
