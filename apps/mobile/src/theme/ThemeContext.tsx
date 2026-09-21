import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import {
  getAppearancePreference,
  setAppearancePreference,
} from '@/src/services/appearance';
import {
  darkColors,
  lightColors,
  makeShadows,
  paperThemeFrom,
  type AppearancePreference,
  type ColorScheme,
  type ColorTokens,
} from '@/src/theme/tokens';

interface ThemeContextValue {
  colors: ColorTokens;
  scheme: ColorScheme;
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => void;
  shadows: ReturnType<typeof makeShadows>;
  paperColors: ReturnType<typeof paperThemeFrom>['colors'];
  reduceMotion: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  preference: AppearancePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference === 'system') {
    return system === 'light' ? 'light' : 'dark';
  }
  return preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void getAppearancePreference().then(setPreferenceState);
  }, []);

  useEffect(() => {
    const apply = (value: boolean) => setReduceMotion(value);
    void AccessibilityInfo.isReduceMotionEnabled().then(apply);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => sub.remove();
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    void setAppearancePreference(next);
  }, []);

  const scheme = resolveScheme(preference, systemScheme);

  const value = useMemo<ThemeContextValue>(() => {
    const colors: ColorTokens = scheme === 'light' ? lightColors : darkColors;
    return {
      colors,
      scheme,
      preference,
      setPreference,
      shadows: makeShadows(scheme),
      paperColors: paperThemeFrom(colors).colors,
      reduceMotion,
    };
  }, [preference, reduceMotion, scheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const colors = darkColors;
    return {
      colors,
      scheme: 'dark',
      preference: 'dark',
      setPreference: () => undefined,
      shadows: makeShadows('dark'),
      paperColors: paperThemeFrom(colors).colors,
      reduceMotion: false,
    };
  }
  return ctx;
}
