import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface SectionHeaderProps {
  title: string;
  meta?: string;
  actionLabel?: string;
  actionIcon?: AppIconName;
  onAction?: () => void;
}

/** Section title with an optional quiet text action. */
export function SectionHeader({
  title,
  meta,
  actionLabel,
  actionIcon,
  onAction,
}: SectionHeaderProps) {
  const { colors } = useTheme();
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
          hitSlop={10}
          style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }, styles.action]}
        >
          {actionIcon === 'star-outline' || actionIcon === 'star' ? (
            <Star size={14} color={colors.accent} fill={colors.accent} />
          ) : actionIcon ? (
            <Icon name={actionIcon} size={14} color={colors.accent} />
          ) : null}
          <Text style={[styles.actionLabel, { color: colors.accent }]} numberOfLines={1}>
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.smd,
    marginTop: spacing.sm,
    width: '100%',
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.35,
    flex: 1,
    minWidth: 0,
  },
  meta: {
    ...typography.caption,
    flexShrink: 0,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    paddingVertical: 4,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
