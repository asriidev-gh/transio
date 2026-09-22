import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Smart Transcriber — Fintech-premium glass language.
 * Soft canvas, blue→violet primary gradient, generous radii, quiet shadows.
 * Prefer useTheme() so light/dark both work.
 */
export const darkColors = {
  background: '#070914',
  backgroundAlt: '#0C0F1C',
  surface: '#121526',
  surfaceAlt: '#1A1E32',
  ink: '#F8FAFC',
  inkMuted: '#9CA3AF',
  tertiary: '#6B7280',
  brand: '#6B7CFF',
  brandSoft: '#9B7CFF',
  accent: '#7B6CFF',
  accentSoft: 'rgba(123, 108, 255, 0.2)',
  accentDeep: '#5B4CE8',
  cyan: '#38BDF8',
  cyanSoft: '#7DD3FC',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  border: '#24283A',
  recording: '#EF4444',
  player: '#121526',
  playerText: '#F8FAFC',
  playerMuted: '#9CA3AF',
  onBrand: '#FFFFFF',
  overlay: 'rgba(7, 9, 20, 0.72)',
  actionRecord: 'rgba(123, 108, 255, 0.18)',
  actionImport: 'rgba(56, 189, 248, 0.14)',
  actionFav: 'rgba(245, 158, 11, 0.14)',
  actionSettings: 'rgba(156, 163, 175, 0.12)',
  glass: 'rgba(18, 21, 38, 0.78)',
  glassBorder: 'rgba(248, 250, 252, 0.08)',
} as const;

export const lightColors = {
  background: '#F4F6FB',
  backgroundAlt: '#EEF1F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F3FA',
  ink: '#0F172A',
  inkMuted: '#64748B',
  tertiary: '#94A3B8',
  brand: '#4A6CF7',
  brandSoft: '#8B7CFF',
  accent: '#5B6CFF',
  accentSoft: 'rgba(74, 108, 247, 0.12)',
  accentDeep: '#3D52D9',
  cyan: '#38BDF8',
  cyanSoft: '#7DD3FC',
  success: '#059669',
  warning: '#F59E0B',
  danger: '#EF4444',
  border: 'rgba(15, 23, 42, 0.06)',
  recording: '#EF4444',
  player: '#0F172A',
  playerText: '#F8FAFC',
  playerMuted: '#94A3B8',
  onBrand: '#FFFFFF',
  overlay: 'rgba(15, 23, 42, 0.4)',
  actionRecord: 'rgba(74, 108, 247, 0.12)',
  actionImport: 'rgba(56, 189, 248, 0.12)',
  actionFav: 'rgba(245, 158, 11, 0.12)',
  actionSettings: 'rgba(100, 116, 139, 0.1)',
  glass: 'rgba(255, 255, 255, 0.82)',
  glassBorder: 'rgba(15, 23, 42, 0.06)',
} as const;

export type ColorTokenKey = keyof typeof darkColors;
export type ColorTokens = Record<ColorTokenKey, string>;

export type ColorScheme = 'light' | 'dark';
export type AppearancePreference = 'system' | ColorScheme;

/** Primary CTA / hero gradient stops — blue → violet (reference). */
export const gradients = {
  primary: ['#4A6CF7', '#A064FF'] as const,
  aurora: ['#4A6CF7', '#7B6CFF', '#A064FF'] as const,
  recording: ['#4A6CF7', '#EF4444'] as const,
  soft: ['rgba(74, 108, 247, 0.14)', 'rgba(160, 100, 255, 0.10)'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  /** 20 — compact section gaps */
  lgSoft: 20,
  lg: 24,
  xl: 32,
  xxl: 40,
  huge: 48,
  massive: 64,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  card: 24,
  button: 18,
  pill: 999,
} as const;

export const motion = {
  fast: 200,
  base: 280,
  slow: 400,
} as const;

export const sizes = {
  icon: 22,
  iconLg: 28,
  hit: 44,
  button: 52,
  avatar: 40,
  record: 64,
} as const;

export const fonts = {
  /** UI body / labels */
  sans: 'PlusJakartaSans_500Medium',
  sansSemi: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  /** Display / hero headlines */
  display: 'Fraunces_700Bold',
  displaySemi: 'Fraunces_600SemiBold',
  mono: 'SpaceMono',
} as const;

export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.7,
  },
  brand: {
    fontFamily: fonts.sansBold,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  pageTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: fonts.sansSemi,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  section: {
    fontFamily: fonts.sansBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.25,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  transcript: {
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 28,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.15,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
  },
} as const satisfies Record<string, TextStyle>;

export function makeShadows(scheme: ColorScheme): {
  soft: ViewStyle;
  float: ViewStyle;
  emboss: ViewStyle;
} {
  const light = scheme === 'light';
  if (!light) {
    return {
      soft: { elevation: 0 },
      float: { elevation: 0 },
      emboss: {
        ...Platform.select<ViewStyle>({
          ios: {
            shadowColor: '#7B6CFF',
            shadowOpacity: 0.35,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          },
          android: { elevation: 8 },
          default: {
            shadowColor: '#7B6CFF',
            shadowOpacity: 0.35,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          },
        }),
      },
    };
  }
  return {
    soft: Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#64748B',
        shadowOpacity: 0.1,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 3 },
      default: {
        shadowColor: '#64748B',
        shadowOpacity: 0.1,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
      },
    })!,
    float: Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#475569',
        shadowOpacity: 0.12,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 6 },
      default: {
        shadowColor: '#475569',
        shadowOpacity: 0.12,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 10 },
      },
    })!,
    emboss: Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#4A6CF7',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
      default: {
        shadowColor: '#4A6CF7',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
    })!,
  };
}

export const paperThemeFrom = (colors: ColorTokens) => ({
  colors: {
    primary: colors.accent,
    secondary: colors.cyan,
    background: colors.background,
    surface: colors.surface,
    error: colors.danger,
    onPrimary: colors.onBrand,
    onSecondary: colors.onBrand,
    onBackground: colors.ink,
    onSurface: colors.ink,
    outline: colors.border,
  },
});
