import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { Button } from '@/src/components/ui/Button';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface TranslateLanguageSheetProps {
  visible: boolean;
  activeLanguage: TranslateLanguage | null;
  busy?: boolean;
  onClose: () => void;
  /** Called when the user confirms a language (or Original via null). */
  onProceed: (language: TranslateLanguage | null) => void;
}

/**
 * Language picker with an explicit Proceed step (does not translate on row tap).
 */
export function TranslateLanguageSheet({
  visible,
  activeLanguage,
  busy = false,
  onClose,
  onProceed,
}: TranslateLanguageSheetProps) {
  const { colors, shadows } = useTheme();
  const [draft, setDraft] = useState<TranslateLanguage | null>(activeLanguage);

  useEffect(() => {
    if (visible) setDraft(activeLanguage);
  }, [visible, activeLanguage]);

  const draftLabel = useMemo(() => {
    if (!draft) return 'Original';
    return TRANSLATE_LANGUAGE_LABELS[draft] ?? draft;
  }, [draft]);

  const options = useMemo(
    () => [{ code: null as TranslateLanguage | null, label: 'Original' }, ...TRANSLATE_LANGUAGE_OPTIONS],
    [],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={busy ? undefined : onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            shadows.soft,
          ]}
          onPress={(e) => e.stopPropagation?.()}
          accessibilityRole="menu"
          accessibilityLabel="Choose language"
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
          <Text style={[styles.title, { color: colors.ink }]}>Translate notes</Text>
          <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
            Pick a language, then tap Proceed.
          </Text>

          <FlatList
            data={options}
            keyExtractor={(item) => item.code ?? 'original'}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = item.code === draft;
              return (
                <Pressable
                  style={[
                    styles.option,
                    { borderTopColor: colors.border },
                    selected && { backgroundColor: colors.accentSoft },
                  ]}
                  onPress={() => setDraft(item.code)}
                  disabled={busy}
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
                  {selected ? (
                    <Text style={[styles.check, { color: colors.accent }]}>✓</Text>
                  ) : null}
                </Pressable>
              );
            }}
          />

          <View style={styles.actions}>
            <Button
              label={busy ? 'Translating…' : `Proceed · ${draftLabel}`}
              onPress={() => onProceed(draft)}
              loading={busy}
              disabled={busy}
            />
            <Button label="Cancel" variant="secondary" onPress={onClose} disabled={busy} />
          </View>
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.busyText, { color: colors.inkMuted }]}>
                Translating notes…
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '78%',
    paddingBottom: spacing.lg,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  title: {
    ...typography.title,
    fontSize: 18,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    ...typography.body,
  },
  check: {
    fontSize: 16,
    fontWeight: '700',
  },
  actions: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  busyText: {
    ...typography.caption,
  },
});
