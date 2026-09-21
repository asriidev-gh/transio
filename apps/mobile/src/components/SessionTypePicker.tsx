import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SESSION_TYPE_LABELS, type SessionType } from '@sessionai/shared';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

const BUILTIN_TYPES = (Object.keys(SESSION_TYPE_LABELS) as SessionType[]).filter(
  (type) => type !== 'other',
);

interface SessionTypePickerProps {
  value: SessionType;
  onChange: (value: SessionType) => void;
  /** Label when value is `other` (saved customs or free text). */
  customLabel?: string;
  onCustomLabelChange?: (label: string) => void;
  /** Previously saved custom type chips. */
  customTypes?: string[];
  disabled?: boolean;
}

export function SessionTypePicker({
  value,
  onChange,
  customLabel = '',
  onCustomLabelChange,
  customTypes = [],
  disabled,
}: SessionTypePickerProps) {
  const { colors } = useTheme();
  const trimmedCustom = customLabel.trim();
  const otherSelected =
    value === 'other' &&
    (!trimmedCustom || !customTypes.some((t) => t.toLowerCase() === trimmedCustom.toLowerCase()));

  function selectBuiltin(type: SessionType) {
    onChange(type);
    onCustomLabelChange?.('');
  }

  function selectCustom(label: string) {
    onChange('other');
    onCustomLabelChange?.(label);
  }

  function selectOther() {
    onChange('other');
    if (
      trimmedCustom &&
      customTypes.some((t) => t.toLowerCase() === trimmedCustom.toLowerCase())
    ) {
      onCustomLabelChange?.('');
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {BUILTIN_TYPES.map((type) => {
          const selected = type === value;
          return (
            <Pressable
              key={type}
              onPress={() => selectBuiltin(type)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.accent : colors.surface,
                  opacity: pressed && !selected ? 0.85 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={SESSION_TYPE_LABELS[type]}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: selected ? colors.onBrand : colors.ink },
                ]}
              >
                {SESSION_TYPE_LABELS[type]}
              </Text>
            </Pressable>
          );
        })}

        {customTypes.map((label) => {
          const selected =
            value === 'other' && trimmedCustom.toLowerCase() === label.toLowerCase();
          return (
            <Pressable
              key={`custom:${label}`}
              onPress={() => selectCustom(label)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.accent : colors.surface,
                  opacity: pressed && !selected ? 0.85 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: selected ? colors.onBrand : colors.ink },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={selectOther}
          disabled={disabled}
          style={({ pressed }) => [
            styles.option,
            {
              borderColor: otherSelected ? colors.accent : colors.border,
              backgroundColor: otherSelected ? colors.accent : colors.surface,
              opacity: pressed && !otherSelected ? 0.85 : 1,
            },
          ]}
          accessibilityRole="radio"
          accessibilityState={{ selected: otherSelected }}
          accessibilityLabel="Other"
        >
          <Text
            style={[
              styles.optionText,
              { color: otherSelected ? colors.onBrand : colors.ink },
            ]}
          >
            Other
          </Text>
        </Pressable>
      </View>

      {value === 'other' ? (
        <View style={styles.customField}>
          <Text style={[styles.customHint, { color: colors.inkMuted }]}>
            Name this type — it’ll show up next time you record.
          </Text>
          <TextInput
            style={[
              styles.customInput,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                color: colors.ink,
              },
            ]}
            value={customLabel}
            onChangeText={(text) => {
              onChange('other');
              onCustomLabelChange?.(text);
            }}
            placeholder="e.g. Workshop, Interview, Podcast"
            placeholderTextColor={colors.tertiary}
            editable={!disabled}
            maxLength={40}
            autoCapitalize="words"
            accessibilityLabel="Custom session type"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    minHeight: 40,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  customField: {
    gap: spacing.xs,
  },
  customHint: {
    ...typography.meta,
  },
  customInput: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
});
