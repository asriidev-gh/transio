import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SESSION_TYPE_LABELS, type SessionType } from '@sessionai/shared';
import { colors, spacing, typography } from '@/src/theme';

const SESSION_TYPES = Object.keys(SESSION_TYPE_LABELS) as SessionType[];

interface SessionTypePickerProps {
  value: SessionType;
  onChange: (value: SessionType) => void;
  disabled?: boolean;
}

export function SessionTypePicker({ value, onChange, disabled }: SessionTypePickerProps) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {SESSION_TYPES.map((type) => {
        const selected = type === value;
        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            disabled={disabled}
            style={[styles.option, selected && styles.optionSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={SESSION_TYPE_LABELS[type]}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
              {SESSION_TYPE_LABELS[type]}
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
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  optionSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  optionText: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
});
