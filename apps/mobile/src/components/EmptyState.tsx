import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';

interface EmptyStateProps {
  title: string;
  description: string;
  variant?: 'default' | 'hero';
  icon?: AppIconName;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function EmptyState({
  title,
  description,
  variant = 'default',
  icon,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const hero = variant === 'hero';

  return (
    <View
      style={[styles.container, hero && styles.hero]}
      accessibilityRole="summary"
    >
      {icon ? <Icon name={icon} size={hero ? 64 : 36} /> : null}
      <Text style={[styles.title, { color: colors.ink }, hero && styles.titleHero]}>{title}</Text>
      <Text style={[styles.description, { color: colors.inkMuted }]}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={styles.actions}>
          <Button label={actionLabel} onPress={onAction} />
          {secondaryLabel && onSecondary ? (
            <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  hero: {
    paddingVertical: spacing.xxl,
    maxWidth: 360,
  },
  title: {
    ...typography.section,
  },
  titleHero: {
    ...typography.pageTitle,
  },
  description: {
    ...typography.body,
    maxWidth: 340,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
