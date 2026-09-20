/**
 * SessionAI visual theme — Harbor Studio.
 * Cool fog surfaces, deep harbor ink, signal teal. Distinct from blue Material
 * clones and warm parchment/terracotta defaults.
 */
import { Platform } from 'react-native';

export const colors = {
  background: '#D8E0E4',
  backgroundAlt: '#C5D0D6',
  surface: '#F4F7F8',
  ink: '#0B1A22',
  inkMuted: '#5A6B74',
  brand: '#0B1F2A',
  brandSoft: '#1A3A4A',
  accent: '#1AA6B7',
  accentSoft: '#C8EBF0',
  success: '#1F7A5C',
  danger: '#C41E3A',
  border: '#B8C5CC',
  recording: '#C41E3A',
  player: '#0B1F2A',
  playerText: '#E8F0F2',
  playerMuted: '#9BB0B8',
  onBrand: '#F4F7F8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
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
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 12,
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
    onPrimary: colors.onBrand,
    onSecondary: colors.brand,
    onBackground: colors.ink,
    onSurface: colors.ink,
    outline: colors.border,
  },
};
