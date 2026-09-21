import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  TRANSLATE_LANGUAGE_LABELS,
  TRANSLATE_LANGUAGE_OPTIONS,
  type TranslateLanguage,
} from '@sessionai/shared';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface TranslateBarProps {
  activeLanguage: TranslateLanguage | null;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  onSelect: (language: TranslateLanguage | null) => void;
}

export function TranslateBar({
  activeLanguage,
  busy = false,
  busyLabel,
  disabled = false,
  onSelect,
}: TranslateBarProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const locked = busy || disabled;

  const selectedLabel = useMemo(() => {
    if (busy && busyLabel) return busyLabel;
    if (!activeLanguage) return 'Original';
    return TRANSLATE_LANGUAGE_LABELS[activeLanguage] ?? activeLanguage;
  }, [activeLanguage, busy, busyLabel]);

  function choose(language: TranslateLanguage | null) {
    setOpen(false);
    onSelect(language);
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Translate">
      <Text style={[styles.label, { color: colors.inkMuted }]}>Translate to</Text>
      <View style={styles.row}>
        <Pressable
          style={[
            styles.select,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
            locked && styles.selectDisabled,
          ]}
          onPress={() => {
            if (!locked) setOpen(true);
          }}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel={`Language: ${selectedLabel}`}
          accessibilityState={{ expanded: open, disabled: locked }}
        >
          <Text style={[styles.selectText, { color: colors.ink }]} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <Text style={[styles.chevron, { color: colors.inkMuted }]}>▾</Text>
        </Pressable>
        {busy ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation?.()}
            accessibilityRole="menu"
            accessibilityLabel="Choose language"
          >
            <Text style={[styles.sheetTitle, { color: colors.ink }]}>Choose language</Text>
            <FlatList
              data={[{ code: null, label: 'Original' }, ...TRANSLATE_LANGUAGE_OPTIONS]}
              keyExtractor={(item) => item.code ?? 'original'}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected =
                  item.code === null
                    ? activeLanguage === null
                    : activeLanguage === item.code;
                return (
                  <Pressable
                    style={[
                      styles.option,
                      { borderTopColor: colors.border },
                      selected && { backgroundColor: colors.accentSoft },
                    ]}
                    onPress={() => choose(item.code)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: colors.ink },
                        selected && { fontWeight: '700', color: colors.accentDeep },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
            <Pressable
              style={styles.cancel}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.cancelText, { color: colors.inkMuted }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  select: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  selectDisabled: {
    opacity: 0.55,
  },
  selectText: {
    ...typography.body,
    flexShrink: 1,
  },
  chevron: {
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: radii.md,
    borderWidth: 1,
    maxHeight: '70%',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    overflow: 'hidden',
  },
  sheetTitle: {
    ...typography.body,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    ...typography.body,
  },
  cancel: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    ...typography.body,
    fontWeight: '600',
  },
});
