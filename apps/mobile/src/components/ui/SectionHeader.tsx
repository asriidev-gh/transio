import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface SectionHeaderProps {
  title: string;
  meta?: string;
  actionLabel?: string;
  actionIcon?: AppIconName;
  onAction?: () => void;
}

/** Section title with an optional compact action. */
export function SectionHeader({
  title,
  meta,
  actionLabel,
  actionIcon,
  onAction,
}: SectionHeaderProps) {
  const { colors, shadows } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.actionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
            shadows.soft,
          ]}
        >
          {actionIcon === 'star-outline' || actionIcon === 'star' ? (
            <Star size={16} color={colors.accent} fill={colors.accent} />
          ) : actionIcon ? (
            <Icon name={actionIcon} size={16} color={colors.accent} />
          ) : null}
          <Text style={[styles.actionLabel, { color: colors.ink }]} numberOfLines={1}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : meta ? (
        <Text style={[styles.meta, { color: colors.tertiary }]}>{meta}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    width: '100%',
  },
  title: {
    ...typography.section,
    flex: 1,
    minWidth: 0,
  },
  meta: {
    ...typography.caption,
    flexShrink: 0,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.smd,
    minHeight: 36,
    flexShrink: 0,
    maxWidth: '48%',
  },
  actionLabel: {
    ...typography.caption,
    fontWeight: '700',
    flexShrink: 1,
  },
});
