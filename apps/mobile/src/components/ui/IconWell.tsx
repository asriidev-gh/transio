import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { radii } from '@/src/theme';

interface IconWellProps {
  name: AppIconName;
  tint: string;
  color?: string;
  size?: number;
  wellSize?: number;
  style?: ViewStyle;
}

/**
 * Soft circular icon well — banking-reference pattern
 * (thin line glyph inside a tinted round container).
 */
export function IconWell({
  name,
  tint,
  color,
  size = 20,
  wellSize = 44,
  style,
}: IconWellProps) {
  return (
    <View
      style={[
        styles.well,
        {
          width: wellSize,
          height: wellSize,
          borderRadius: wellSize / 2,
          backgroundColor: tint,
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={color} variant="line" />
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Squircle well for feature tiles (slightly less round than circle). */
export function IconSquircle({
  name,
  tint,
  color,
  size = 22,
  wellSize = 44,
  style,
}: IconWellProps) {
  return (
    <View
      style={[
        styles.well,
        {
          width: wellSize,
          height: wellSize,
          borderRadius: radii.md,
          backgroundColor: tint,
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={color} variant="line" />
    </View>
  );
}
