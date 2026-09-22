import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

const LOGO_LIGHT = require('../../assets/images/smart_transcriber_logo_light.png');
const LOGO_DARK = require('../../assets/images/smart_transcriber_logo_dark.png');

/** Natural aspect (width / height) of the Smart Transcriber lockup. */
const ASPECT = 815 / 1024;

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
   * Off by default — art sits on the page canvas.
   */
  elevated?: boolean;
}

/** Smart Transcriber brand lockup — light/dark variants. */
export function BrandLogo({
  size = 96,
  variant: _variant = 'mark',
  style,
  accessibilityLabel = 'Smart Transcriber',
  elevated = false,
}: BrandLogoProps) {
  const { scheme, shadows, colors } = useTheme();
  const isLight = scheme === 'light';
  const source = isLight ? LOGO_LIGHT : LOGO_DARK;

  const height = size;
  const width = Math.round(size * ASPECT);
  const pad = elevated ? Math.max(6, Math.round(size * 0.08)) : 0;
  const radius = Math.max(radii.md, Math.round((size + pad * 2) * 0.18));

  return (
    <View
      style={[
        styles.wrap,
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
      <Image source={source} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
