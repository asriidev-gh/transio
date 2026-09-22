/**
 * Smart Transcriber design tokens — AI-native indigo/cyan on soft light or OLED dark.
 * Screens should prefer useTheme() so light/dark both work.
 * `colors` defaults to the dark palette for StyleSheet.create modules.
 */
export {
  darkColors,
  fonts,
  gradients,
  lightColors,
  makeShadows,
  motion,
  paperThemeFrom,
  radii,
  sizes,
  spacing,
  typography,
  type AppearancePreference,
  type ColorScheme,
  type ColorTokens,
} from '@/src/theme/tokens';

export { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';

import { darkColors, makeShadows, paperThemeFrom } from '@/src/theme/tokens';

/** Brand (slate) tokens — used by existing StyleSheet.create modules. */
export const colors = darkColors;
export const shadows = makeShadows('dark');
export const paperTheme = paperThemeFrom(darkColors);
