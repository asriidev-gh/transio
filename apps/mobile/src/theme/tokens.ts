import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Transio — soft 3D / claymorphism.
 * Dark: mint clay on deep slate. Light: white clay on warm cream (logo canvas).
 */
export const darkColors = {
  background: '#1E313B',
  backgroundAlt: '#172A35',
  surface: '#253B47',
  ink: '#E6F5EE',
  inkMuted: '#6E8B97',
  tertiary: '#5A7582',
  brand: '#9DE0AD',
  brandSoft: '#A2E3C4',
  accent: '#9DE0AD',
  accentSoft: '#2A4652',
  accentDeep: '#7BC992',
  success: '#9DE0AD',
  warning: '#E0C07A',
  danger: '#E07A7A',
  border: '#334E5A',
  recording: '#E07A7A',
  player: '#172A35',
  playerText: '#E6F5EE',
  playerMuted: '#6E8B97',
  onBrand: '#1E313B',
  overlay: 'rgba(10, 20, 26, 0.55)',
  actionRecord: '#3A2A2E',
  actionImport: '#2A4652',
  actionFav: '#2E3F52',
  actionSettings: '#3A3A2E',
} as const;

/** Cream canvas from the light lockup (~#EDE9DC) + white surfaces + slate ink. */
export const lightColors = {
  background: '#EDE9DC',
  backgroundAlt: '#E5E1D4',
  surface: '#F7F5EE',
  ink: '#1E313B',
  inkMuted: '#6E6B62',
  tertiary: '#8A877C',
  brand: '#1E313B',
  brandSoft: '#2A4652',
  accent: '#2A4652',
  accentSoft: '#E0DCCE',
  accentDeep: '#1E313B',
  success: '#4F8F6A',
  warning: '#B8892E',
  danger: '#C45C5C',
  border: '#D6D1C2',
  recording: '#C45C5C',
  player: '#1E313B',
  playerText: '#F7F5EE',
  playerMuted: '#9A978C',
  onBrand: '#F7F5EE',
  overlay: 'rgba(30, 49, 59, 0.4)',
  actionRecord: '#E8DFE0',
  actionImport: '#DFE6E4',
  actionFav: '#E0E4EA',
  actionSettings: '#E8E6DC',
} as const;

export type ColorTokenKey = keyof typeof darkColors;
export type ColorTokens = Record<ColorTokenKey, string>;

export type ColorScheme = 'light' | 'dark';
export type AppearancePreference = 'system' | ColorScheme;

export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 9999,
} as const;

export const motion = {
  fast: 160,
  base: 220,
  slow: 300,
} as const;

export const sizes = {
  icon: 24,
  iconLg: 32,
  hit: 44,
  button: 52,
  avatar: 36,
} as const;

export const fonts = {
  mono: Platform.select({
    ios: 'SpaceMono',
    android: 'SpaceMono',
    default: 'SpaceMono',
  }) as string,
} as const;

export const typography = {
  brand: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  section: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  transcript: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '400' as const,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
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
  const opacity = light
    ? { soft: 0.12, float: 0.16, emboss: 0.2 }
    : { soft: 0.28, float: 0.35, emboss: 0.4 };
  const shadowColor = light ? '#6E6B62' : '#000';
  return {
    soft: Platform.select<ViewStyle>({
      ios: {
        shadowColor,
        shadowOpacity: opacity.soft,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: light ? 2 : 4 },
      default: {
        shadowColor,
        shadowOpacity: opacity.soft,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
    })!,
    float: Platform.select<ViewStyle>({
      ios: {
        shadowColor,
        shadowOpacity: opacity.float,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: light ? 4 : 8 },
      default: {
        shadowColor,
        shadowOpacity: opacity.float,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
    })!,
    emboss: Platform.select<ViewStyle>({
      ios: {
        shadowColor,
        shadowOpacity: opacity.emboss,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: light ? 6 : 10 },
      default: {
        shadowColor,
        shadowOpacity: opacity.emboss,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
    })!,
  };
}

export const paperThemeFrom = (colors: ColorTokens) => ({
  colors: {
    primary: colors.accent,
    secondary: colors.accent,
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
