import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

export type SessionTabKey = 'notes' | 'summary' | 'transcript' | 'ask' | 'actions' | 'map';

interface SessionTabsProps {
  value: SessionTabKey;
  onChange: (key: SessionTabKey) => void;
  notesOnly?: boolean;
  hasAiSummary?: boolean;
  /** Notes-only sessions: Translate control sits in the Notes header (right). */
  onTranslatePress?: () => void;
  translateBusy?: boolean;
  translateDisabled?: boolean;
}

export function SessionTabs({
  value,
  onChange,
  notesOnly = false,
  hasAiSummary = false,
  onTranslatePress,
  translateBusy = false,
  translateDisabled = false,
}: SessionTabsProps) {
  const { colors } = useTheme();

  if (notesOnly) {
    const translateIdle = translateDisabled || translateBusy || !onTranslatePress;
    return (
      <View
        style={[styles.notesOnlyBar, { backgroundColor: colors.backgroundAlt }]}
        accessibilityRole="header"
        accessibilityLabel="Notes"
      >
        <Text style={[styles.notesOnlyTitle, { color: colors.ink }]}>Notes</Text>
        {onTranslatePress ? (
          <Pressable
            onPress={onTranslatePress}
            disabled={translateIdle}
            accessibilityRole="button"
            accessibilityLabel={translateBusy ? 'Translating notes' : 'Translate notes'}
            style={({ pressed }) => [
              styles.translateChip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: translateIdle ? 0.45 : pressed ? 0.88 : 1,
              },
            ]}
          >
            {translateBusy ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Icon name="translate" size={16} color={colors.brand} variant="line" />
            )}
            <Text style={[styles.translateChipLabel, { color: colors.ink }]}>
              {translateBusy ? 'Translating…' : 'Translate'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const tabs: Array<{ key: SessionTabKey; label: string }> = [
    { key: 'notes', label: 'Notes' },
    ...(hasAiSummary ? [{ key: 'summary' as const, label: 'Summary' }] : []),
    { key: 'transcript', label: 'Transcript' },
    { key: 'ask', label: 'Ask' },
    { key: 'map', label: 'Map' },
  ];

  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.backgroundAlt }]}
      accessibilityRole="tablist"
      accessibilityLabel="Session views"
    >
      {tabs.map((tab) => {
        const selected = value === tab.key;
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
    flexWrap: 'wrap',
    gap: 2,
    padding: 4,
    borderRadius: radii.md,
  },
  notesOnlyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    minHeight: 48,
  },
  notesOnlyTitle: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  translateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  translateChipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tab: {
    flexGrow: 1,
    flexBasis: 64,
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
