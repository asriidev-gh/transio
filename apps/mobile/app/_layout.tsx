import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
// Import weight entry points only — the package barrel requires every italic file and breaks Metro on web.
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';
import { ConfirmHost } from '@/src/components/ConfirmHost';
import { LoadingState } from '@/src/components/LoadingState';
import { hasSeenOnboarding } from '@/src/services/onboarding';
import { View, StyleSheet } from 'react-native';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [seenOnboarding, setSeenOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const seen = await hasSeenOnboarding();
      if (!cancelled) {
        setSeenOnboarding(seen);
        setOnboardingReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [segments]);

  useEffect(() => {
    if (isLoading || !fontsLoaded || !onboardingReady) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const onOnboarding = segments[0] === 'onboarding';

    if (!seenOnboarding && !onOnboarding) {
      router.replace('/onboarding');
      return;
    }

    if (!seenOnboarding && onOnboarding) {
      return;
    }

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (session && (inAuthGroup || onOnboarding)) {
      router.replace('/');
    }
  }, [
    session,
    isLoading,
    fontsLoaded,
    onboardingReady,
    seenOnboarding,
    segments,
    router,
  ]);

  useEffect(() => {
    if (!isLoading && fontsLoaded && onboardingReady) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded, onboardingReady]);

  if (isLoading || !fontsLoaded || !onboardingReady) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.background }]}>
        <LoadingState message="Starting Smart Transcriber…" />
      </View>
    );
  }

  return children;
}

function ThemedRoot() {
  const { colors, paperColors, scheme } = useTheme();
  const base = scheme === 'light' ? MD3LightTheme : MD3DarkTheme;
  const paper = {
    ...base,
    colors: {
      ...base.colors,
      ...paperColors,
    },
  };

  return (
    <PaperProvider theme={paper}>
      <AuthProvider>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
        <AuthGate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.ink,
              contentStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
              animation: 'fade',
            }}
          >
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack>
        </AuthGate>
        <ConfirmHost />
      </AuthProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
