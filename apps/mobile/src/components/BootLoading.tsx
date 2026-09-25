import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LoadingState } from '@/src/components/LoadingState';
import { DarkThemeScope } from '@/src/theme/ThemeContext';

/** Matches product mark canvas / adaptive icon. */
export const BOOT_BACKGROUND = '#0A111A';

/**
 * Full-screen boot splash — same brand loader as in-app pages
 * (mark + pulse rings + equalizer), then hands off to the app.
 */
export function BootLoading() {
  useEffect(() => {
    const hide = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, 120);
    return () => clearTimeout(hide);
  }, []);

  return (
    <View
      style={[styles.root, { backgroundColor: BOOT_BACKGROUND }]}
      accessibilityLabel="Starting Smart Transcriber"
      accessibilityRole="progressbar"
    >
      <DarkThemeScope>
        <LoadingState message="Smart Transcriber" detail="Getting things ready…" />
      </DarkThemeScope>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
