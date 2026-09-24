import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { APP_NAME } from '@/src/data/brand';
import { radii } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

/** Transparent lockups (cropped). Prefer PNG over JPG canvases. */
const LOGO_LIGHT = require('../../assets/images/smart_transcriber_logo_light.png');
const LOGO_DARK = require('../../assets/images/smart_transcriber_logo_dark.png');
/** Launcher / product mark — mic + waveform + network art. */
const MARK = require('../../assets/images/app-icon.png');

/** Natural aspect (width / height) of the cropped lockup PNGs. */
const LOCKUP_ASPECT = 816 / 900;
/** Square product mark. */
const MARK_ASPECT = 1;

type BrandLogoVariant = 'mark' | 'app' | 'lockup';

interface BrandLogoProps {
  /**
   * Display height in px. Use ≥160 on auth heroes so the lockup stays sharp.
   */
  size?: number;
  /**
   * `lockup` / `app` = full logo with wordmark.
   * `mark` = icon only (no wordmark) — pair with a separate text title.
   */
  variant?: BrandLogoVariant;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /**
   * Soft surface tile behind the lockup.
   * Off by default — art sits on the page canvas.
   */
  elevated?: boolean;
}

/** Smart Transcriber brand art — light/dark lockups + mark. */
export function BrandLogo({
  size = 120,
  variant = 'lockup',
  style,
  accessibilityLabel = APP_NAME,
  elevated = false,
}: BrandLogoProps) {
  const { scheme, shadows, colors } = useTheme();
  const isLight = scheme === 'light';
  const useMark = variant === 'mark';
  const source = useMark ? MARK : isLight ? LOGO_LIGHT : LOGO_DARK;
  const aspect = useMark ? MARK_ASPECT : LOCKUP_ASPECT;

  const height = size;
  const width = Math.round(size * aspect);
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
    alignSelf: 'center',
  },
});
