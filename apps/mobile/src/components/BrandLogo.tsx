import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

const LOGO_LIGHT = require('../../assets/images/transio_logo_light.png');
const LOGO_DARK = require('../../assets/images/transio_logo_dark.png');

/** Natural aspect (width / height) after transparent crop. */
const ASPECT = {
  light: 232 / 254,
  dark: 232 / 249,
} as const;

type BrandLogoVariant = 'mark' | 'app';

interface BrandLogoProps {
  /** Display height in px; width follows the asset aspect. */
  size?: number;
  /** Kept for call-site compat; both use the full lockup. */
  variant?: BrandLogoVariant;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /**
   * Soft surface tile behind the lockup.
   * Off by default — transparent art sits on the page canvas.
   */
  elevated?: boolean;
}

/** Transio brand art — cream/slate ink on a transparent canvas. */
export function BrandLogo({
  size = 96,
  variant: _variant = 'mark',
  style,
  accessibilityLabel = 'Transio',
  elevated = false,
}: BrandLogoProps) {
  const { scheme, shadows, colors } = useTheme();
  const isLight = scheme === 'light';
  const source = isLight ? LOGO_LIGHT : LOGO_DARK;
  const aspect = isLight ? ASPECT.light : ASPECT.dark;

  const height = size;
  const width = Math.round(size * aspect);
  const pad = elevated ? Math.max(6, Math.round(size * 0.08)) : 0;
  const radius = Math.max(radii.md, Math.round((size + pad * 2) * 0.18));

  return (
    <View
      style={[
        styles.wrap,
        // Soft lift so the lockup feels related to clay cards, not a pasted PNG.
        !elevated && scheme === 'dark' ? shadows.soft : null,
        elevated
          ? [
              shadows.soft,
              {
                padding: pad,
                borderRadius: radius,
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              },
            ]
          : null,
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={source}
        style={{ width, height }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
