import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Preparing…' }: LoadingStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessibilityLabel={message}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[styles.message, { color: colors.inkMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  message: {
    ...typography.meta,
  },
});
