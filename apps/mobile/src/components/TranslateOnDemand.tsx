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
import { Icon } from '@/src/components/ui/Icon';
import { NotesLanguageToggle } from '@/src/components/NotesLanguageToggle';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface TranslateOnDemandProps {
  activeLanguage: TranslateLanguage | null;
  /** Languages already translated for this content. */
  availableLanguages: TranslateLanguage[];
  busy?: boolean;
  disabled?: boolean;
  /** Switch between Original / cached translations (no API call). */
  onSelectCached: (language: TranslateLanguage | null) => void;
  /** Run translation for the chosen language. */
  onTranslate: (language: TranslateLanguage) => void;
}

/**
 * Collapsed “Translate” control → one-line language picker + Go.
 * After a successful translate, language pills appear for switching.
 */
export function TranslateOnDemand({
  activeLanguage,
  availableLanguages,
  busy = false,
  disabled = false,
  onSelectCached,
  onTranslate,
}: TranslateOnDemandProps) {
  const { colors, shadows } = useTheme();
  const [composerOpen, setComposerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<TranslateLanguage | null>(
    availableLanguages[0] ?? 'en',
  );
  const locked = busy || disabled;

  const pendingLabel = useMemo(() => {
    if (!pending) return 'Choose language';
    return TRANSLATE_LANGUAGE_LABELS[pending] ?? pending;
  }, [pending]);

  function openComposer() {
    if (locked) return;
    setPending((prev) => prev ?? availableLanguages[0] ?? 'en');
    setComposerOpen(true);
  }

  function runGo() {
    if (!pending || locked) return;
    onTranslate(pending);
    setComposerOpen(false);
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Translate">
      <NotesLanguageToggle
        activeLanguage={activeLanguage}
        availableLanguages={availableLanguages}
        onSelect={onSelectCached}
      />

      {composerOpen ? (
        <View style={styles.composerRow}>
          <Pressable
            style={[
              styles.select,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
              locked && styles.disabled,
            ]}
            onPress={() => {
              if (!locked) setPickerOpen(true);
            }}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={`Language: ${pendingLabel}`}
          >
            <Text style={[styles.selectText, { color: colors.ink }]} numberOfLines={1}>
              {pendingLabel}
            </Text>
            <Text style={[styles.chevron, { color: colors.inkMuted }]}>▾</Text>
          </Pressable>
          <Pressable
            onPress={runGo}
            disabled={locked || !pending}
            accessibilityRole="button"
            accessibilityLabel="Translate"
            style={({ pressed }) => [
              styles.goBtn,
              {
                backgroundColor: colors.accent,
                opacity: locked || !pending ? 0.5 : pressed ? 0.9 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.onBrand} />
            ) : (
              <Text style={[styles.goText, { color: colors.onBrand }]}>Go</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => setComposerOpen(false)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Cancel translate"
            style={({ pressed }) => [
              styles.cancelBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: busy ? 0.5 : pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.inkMuted }]}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={openComposer}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel="Translate"
          style={({ pressed }) => [
            styles.trigger,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: locked ? 0.55 : pressed ? 0.92 : 1,
            },
            shadows.soft,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Icon name="translate" size={18} color={colors.accent} />
          )}
          <Text style={[styles.triggerLabel, { color: colors.ink }]}>
            {busy ? 'Translating…' : 'Translate'}
          </Text>
        </Pressable>
      )}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setPickerOpen(false)}
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
              data={TRANSLATE_LANGUAGE_OPTIONS}
              keyExtractor={(item) => item.code}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = pending === item.code;
                return (
                  <Pressable
                    style={[
                      styles.option,
                      { borderTopColor: colors.border },
                      selected && { backgroundColor: colors.accentSoft },
                    ]}
                    onPress={() => {
                      setPending(item.code);
                      setPickerOpen(false);
                    }}
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
  trigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  triggerLabel: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
  composerRow: {
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
    minHeight: 44,
  },
  selectText: {
    ...typography.body,
    flexShrink: 1,
  },
  chevron: {
    fontSize: 14,
  },
  goBtn: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
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
});
