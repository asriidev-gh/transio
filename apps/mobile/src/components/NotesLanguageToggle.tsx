import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import {
  TRANSLATE_LANGUAGE_LABELS,
  type TranslateLanguage,
} from '@sessionai/shared';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface NotesLanguageToggleProps {
  activeLanguage: TranslateLanguage | null;
  /** Languages that already have a translation cached. */
  availableLanguages: TranslateLanguage[];
  onSelect: (language: TranslateLanguage | null) => void;
}

/**
 * Pill switcher: Original + any languages the notes have been translated into.
 */
export function NotesLanguageToggle({
  activeLanguage,
  availableLanguages,
  onSelect,
}: NotesLanguageToggleProps) {
  const { colors } = useTheme();

  if (availableLanguages.length === 0) return null;

  const pills: Array<{ code: TranslateLanguage | null; label: string }> = [
    { code: null, label: 'Original' },
    ...availableLanguages.map((code) => ({
      code,
      label: TRANSLATE_LANGUAGE_LABELS[code] ?? code,
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel="Notes language"
    >
      {pills.map((pill) => {
        const selected = pill.code === activeLanguage;
        return (
          <Pressable
            key={pill.code ?? 'original'}
            onPress={() => onSelect(pill.code)}
            style={[
              styles.pill,
              {
                borderColor: selected ? colors.accent : colors.border,
                backgroundColor: selected ? colors.accentSoft : colors.surface,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={pill.label}
          >
            <Text
              style={[
                styles.pillText,
                { color: selected ? colors.accentDeep : colors.inkMuted },
                selected && styles.pillTextSelected,
              ]}
              numberOfLines={1}
            >
              {pill.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  pill: {
    borderWidth: 1.5,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 34,
    justifyContent: 'center',
  },
  pillText: {
    ...typography.caption,
    fontWeight: '600',
  },
  pillTextSelected: {
    fontWeight: '700',
  },
});
