import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/src/theme';

interface CompletionBannerProps {
  title: string;
  onOpen: () => void;
  onDismiss: () => void;
}

export function CompletionBanner({ title, onOpen, onDismiss }: CompletionBannerProps) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.copy}>
        <Text style={styles.heading}>Ready to review</Text>
        <Text style={styles.body} numberOfLines={2}>
          “{title}” finished processing.
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onOpen}
          style={styles.primary}
          accessibilityRole="button"
          accessibilityLabel="Open completed session"
        >
          <Text style={styles.primaryText}>Open</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={styles.secondary}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={styles.secondaryText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  copy: {
    gap: 4,
  },
  heading: {
    ...typography.caption,
    color: colors.brand,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    ...typography.body,
    color: colors.ink,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryText: {
    color: colors.onBrand,
    fontWeight: '700',
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: '600',
  },
});
