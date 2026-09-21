import { Pressable, StyleSheet } from 'react-native';
import { Icon } from '@/src/components/ui/Icon';
import { radii } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

/** Compact light/dark switch for the home header. */
export function ThemeToggle() {
  const { colors, scheme, setPreference, shadows } = useTheme();
  const isLight = scheme === 'light';

  return (
    <Pressable
      onPress={() => setPreference(isLight ? 'dark' : 'light')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      accessibilityState={{ checked: isLight }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
        shadows.soft,
      ]}
    >
      <Icon
        name={isLight ? 'moon-waning-crescent' : 'white-balance-sunny'}
        size={22}
        color={colors.ink}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
