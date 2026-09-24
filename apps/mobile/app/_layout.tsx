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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';
import { ConfirmHost } from '@/src/components/ConfirmHost';
import { BootLoading } from '@/src/components/BootLoading';
import { mobileEnv } from '@/src/lib/env';
import { hasSeenOnboarding } from '@/src/services/onboarding';
import { ShareIntentHandler } from '@/src/components/ShareIntentHandler';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

/** Fire-and-forget /health so Render free tier can wake during boot video. */
function warmApi(): void {
  const base = mobileEnv.apiBaseUrl?.replace(/\/$/, '');
  if (!base) return;
  void fetch(`${base}/health`).catch(() => undefined);
}

function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
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
  /** Keep BootLoading visible briefly so the brand loader can settle. */
  const [minBootDone, setMinBootDone] = useState(false);

  useEffect(() => {
    warmApi();
    const t = setTimeout(() => setMinBootDone(true), 1800);
    return () => clearTimeout(t);
  }, []);

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
    const onPaywall = segments[0] === 'paywall';
    const isAnonymous = session?.user?.is_anonymous === true;

    if (!seenOnboarding && !onOnboarding) {
      router.replace('/onboarding');
      return;
    }

    if (!seenOnboarding && onOnboarding) {
      return;
    }

    // Pre-auth funnel: onboarding → paywall → guest (or email) session.
    if (!session && onPaywall) {
      return;
    }

    if (!session && inAuthGroup) {
      return;
    }

    if (!session) {
      // Returning users who signed out land on login via explicit navigation;
      // cold start after onboarding without a session goes back to the paywall.
      router.replace('/paywall');
      return;
    }

    if (onOnboarding) {
      router.replace('/');
      return;
    }

    // Guests may open login to save an email account; signed-in email users leave auth.
    if (inAuthGroup && !isAnonymous) {
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
    // Native splash is dismissed by BootLoading; keep a safety hide once boot is ready.
    if (!isLoading && fontsLoaded && onboardingReady && minBootDone) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded, onboardingReady, minBootDone]);

  if (isLoading || !fontsLoaded || !onboardingReady || !minBootDone) {
    return <BootLoading />;
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
          <ShareIntentHandler />
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
            <Stack.Screen name="paywall" options={{ title: 'Unlock Pro' }} />
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedRoot />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
