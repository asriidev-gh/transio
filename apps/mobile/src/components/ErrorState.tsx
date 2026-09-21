import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';

interface ErrorStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title,
  description,
  actionLabel = 'Try again',
  onRetry,
}: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Icon name="alert" size={36} />
      <Text style={[styles.title, { color: colors.danger }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.inkMuted }]}>{description}</Text>
      {onRetry ? <Button label={actionLabel} onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.section,
  },
  description: {
    ...typography.body,
  },
});
