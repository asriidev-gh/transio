import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';

export type GlossOrbTint = 'brand' | 'cyan' | 'violet';

/** RGB triples for the three fill stops, before intensity is applied. */
const FILL_RGB: Record<GlossOrbTint, readonly [string, string, string]> = {
  brand: ['160, 100, 255', '74, 108, 247', '123, 108, 255'],
  cyan: ['56, 189, 248', '74, 108, 247', '34, 211, 238'],
  violet: ['192, 132, 252', '124, 58, 237', '160, 100, 255'],
};
const FILL_ALPHA = [0.72, 0.78, 0.82] as const;

/** Extra width the two glow rings add around the orb. */
const HALO_EXTRA = 28;

function alphaHex(alpha: number): string {
  return Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
}

interface GlossOrbProps {
  /** Diameter of the orb itself. */
  size: number;
  tint?: GlossOrbTint;
  /** 0 to 1. Scales the fill, the gloss and the glow. The Record button uses 1. */
  intensity?: number;
  /** Faint glow rings behind the orb. Makes the component larger by 28. */
  halo?: boolean;
  borderWidth?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Candy-glass orb: glow rings, a translucent gradient fill, a glare across the top and a
 * catch-light on the side. Shared by the floating Record button and the onboarding artwork.
 */
export function GlossOrb({
  size,
  tint = 'brand',
  intensity = 1,
  halo = false,
  borderWidth = 3,
  children,
  style,
}: GlossOrbProps) {
  const { colors, shadows, scheme } = useTheme();
  const rim = scheme === 'light' ? colors.background : colors.backgroundAlt;
  const rgb = FILL_RGB[tint];
  const fill = rgb.map((triple, i) => `rgba(${triple}, ${(FILL_ALPHA[i] ?? 0.8) * intensity})`) as [
    string,
    string,
    string,
  ];
  const outer = halo ? size + HALO_EXTRA : size;

  return (
    <View style={[{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }, style]}>
      {halo ? (
        <>
          <View
            style={[
              styles.absolute,
              {
                width: size + 26,
                height: size + 26,
                borderRadius: (size + 26) / 2,
                backgroundColor: colors.brand + alphaHex(0.2 * intensity),
                opacity: 0.9,
              },
            ]}
          />
          <View
            style={[
              styles.absolute,
              {
                width: size + 12,
                height: size + 12,
                borderRadius: (size + 12) / 2,
                backgroundColor: colors.brandSoft + alphaHex(0.25 * intensity),
              },
            ]}
          />
        </>
      ) : null}

      <View
        style={[
          styles.shell,
          { width: size, height: size, borderRadius: size / 2, borderWidth, borderColor: rim },
          shadows.emboss,
        ]}
      >
        <LinearGradient
          colors={fill}
          locations={[0, 0.45, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.fill}
        >
          {/* Specular glare across the top curve */}
          <LinearGradient
            colors={[
              `rgba(255,255,255,${0.85 * intensity})`,
              `rgba(255,255,255,${0.35 * intensity})`,
              `rgba(255,255,255,${0.06 * intensity})`,
              'transparent',
            ]}
            locations={[0, 0.28, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.glare, { borderBottomLeftRadius: size, borderBottomRightRadius: size }]}
            pointerEvents="none"
          />
          {/* Side catch-light */}
          <LinearGradient
            colors={[`rgba(255,255,255,${0.45 * intensity})`, 'transparent']}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 0.55, y: 0.8 }}
            style={[styles.catchLight, { borderRadius: size }]}
            pointerEvents="none"
          />
          <View style={styles.content}>{children}</View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
  },
  shell: {
    overflow: 'hidden',
    ...Platform.select({
      web: { backdropFilter: 'blur(12px)' } as object,
      default: {},
    }),
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glare: {
    position: 'absolute',
    top: 0,
    left: '8%',
    right: '8%',
    height: '52%',
  },
  catchLight: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: '42%',
    height: '42%',
  },
  content: {
    zIndex: 2,
  },
});
