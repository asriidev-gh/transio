import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

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
  const { colors } = useTheme();
  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.backgroundAlt }]}
      accessibilityRole="tablist"
      accessibilityLabel="Session views"
    >
      {TABS.map((tab) => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.key)}
            style={[
              styles.tab,
              selected && { backgroundColor: colors.surface },
            ]}
          >
            <Text
              style={[styles.label, { color: selected ? colors.ink : colors.inkMuted }]}
              numberOfLines={1}
            >
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
    borderRadius: radii.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 2,
    borderRadius: radii.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
