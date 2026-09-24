import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

interface SelectSheetProps<T extends string> {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: Array<SelectOption<T>>;
  value: T;
  searchable?: boolean;
  searchPlaceholder?: string;
  onClose: () => void;
  onSelect: (value: T) => void;
}

/**
 * Bottom sheet select — searchable list for long option sets (languages, voices).
 */
export function SelectSheet<T extends string>({
  visible,
  title,
  subtitle,
  options,
  value,
  searchable = true,
  searchPlaceholder = 'Search',
  onClose,
  onSelect,
}: SelectSheetProps<T>) {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
            shadows.soft,
          ]}
          onPress={(e) => e.stopPropagation?.()}
          accessibilityRole="menu"
          accessibilityLabel={title}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
          <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.inkMuted }]}>{subtitle}</Text>
          ) : null}

          {searchable ? (
            <View
              style={[
                styles.search,
                { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
              ]}
            >
              <Icon name="magnify" size={18} color={colors.inkMuted} variant="line" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.inkMuted}
                style={[styles.searchInput, { color: colors.ink }]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel={searchPlaceholder}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                  <Icon name="close" size={16} color={colors.inkMuted} variant="line" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.inkMuted }]}>No matches</Text>
            }
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  style={[
                    styles.option,
                    { borderTopColor: colors.border },
                    selected && { backgroundColor: colors.accentSoft },
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    onClose();
                  }}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.optionCopy}>
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: selected ? colors.brand : colors.ink },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.hint ? (
                      <Text style={[styles.optionHint, { color: colors.inkMuted }]} numberOfLines={1}>
                        {item.hint}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <Icon name="check" size={18} color={colors.brand} variant="line" />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Compact field that opens a SelectSheet. */
export function SelectField({
  label,
  valueLabel,
  onPress,
  accent,
}: {
  label: string;
  valueLabel: string;
  onPress: () => void;
  accent?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.field,
        {
          backgroundColor: colors.backgroundAlt,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${valueLabel}`}
    >
      <View style={styles.fieldCopy}>
        <Text style={[styles.fieldLabel, { color: colors.inkMuted }]}>{label}</Text>
        <Text style={[styles.fieldValue, { color: accent ?? colors.ink }]} numberOfLines={1}>
          {valueLabel}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.inkMuted} variant="line" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    ...typography.title,
    fontSize: 20,
  },
  subtitle: {
    ...typography.caption,
    marginTop: -4,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.smd,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingVertical: spacing.smd,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionHint: {
    fontSize: 12,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
    ...typography.caption,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smd,
    gap: spacing.sm,
    minHeight: 56,
  },
  fieldCopy: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '700',
  },
});
