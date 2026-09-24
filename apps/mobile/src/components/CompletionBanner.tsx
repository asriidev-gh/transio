import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface CompletionBannerProps {
  title: string;
  onOpen: () => void;
  onDismiss: () => void;
}

export function CompletionBanner({ title, onOpen, onDismiss }: CompletionBannerProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.accentSoft,
          borderColor: colors.accent,
        },
      ]}
      accessibilityRole="summary"
    >
      <View style={styles.copy}>
        <Text style={[styles.heading, { color: colors.brand }]}>Ready to review</Text>
        <Text style={[styles.body, { color: colors.ink }]} numberOfLines={2}>
          “{title}” finished processing.
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onOpen}
          style={[styles.primary, { backgroundColor: colors.brand }]}
          accessibilityRole="button"
          accessibilityLabel="Open completed session"
        >
          <Text style={[styles.primaryText, { color: colors.onBrand }]}>Open</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={[
            styles.secondary,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={[styles.secondaryText, { color: colors.ink }]}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  copy: {
    gap: 4,
  },
  heading: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    ...typography.body,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryText: {
    fontWeight: '700',
  },
  secondary: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    fontWeight: '600',
  },
});
