import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/src/theme';

export type SessionTabKey = 'summary' | 'transcript' | 'ask' | 'actions';

const TABS: Array<{ key: SessionTabKey; label: string }> = [
  { key: 'summary', label: 'Summary' },
  { key: 'transcript', label: 'Transcript' },
  { key: 'ask', label: 'Ask' },
  { key: 'actions', label: 'Actions' },
];

interface SessionTabsProps {
  value: SessionTabKey;
  onChange: (key: SessionTabKey) => void;
}

export function SessionTabs({ value, onChange }: SessionTabsProps) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist" accessibilityLabel="Session views">
      {TABS.map((tab) => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 2,
    padding: 4,
    backgroundColor: 'rgba(11, 31, 42, 0.08)',
    borderRadius: radii.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 2,
    borderRadius: radii.sm,
  },
  tabSelected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    ...typography.caption,
    fontFamily: undefined,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  labelSelected: {
    color: colors.brand,
  },
});
