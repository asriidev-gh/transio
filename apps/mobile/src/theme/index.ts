/**
 * SessionAI visual theme — forest ink + warm parchment.
 * Avoids generic purple/cream AI defaults.
 */
import { Platform } from 'react-native';

export const colors = {
  background: '#F3EEE4',
  backgroundAlt: '#E8E0D2',
  surface: '#FFFBF5',
  ink: '#14211C',
  inkMuted: '#4A5A52',
  brand: '#0F2A24',
  brandSoft: '#1F4A40',
  accent: '#C45C26',
  accentSoft: '#E8A87C',
  success: '#2F6B4F',
  danger: '#A33B2B',
  border: '#D5CBB8',
  recording: '#B42318',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** SpaceMono loaded in root layout; falls back to monospace platforms. */
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
    fontSize: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
  },
} as const;

export const paperTheme = {
  colors: {
    primary: colors.brand,
    secondary: colors.accent,
    background: colors.background,
    surface: colors.surface,
    error: colors.danger,
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onBackground: colors.ink,
    onSurface: colors.ink,
    outline: colors.border,
  },
};
