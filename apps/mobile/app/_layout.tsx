import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { colors, paperTheme } from '@/src/theme';
import { LoadingState } from '@/src/components/LoadingState';
import { View, StyleSheet } from 'react-native';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...paperTheme.colors,
  },
};

function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (isLoading || !fontsLoaded) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, isLoading, fontsLoaded, segments, router]);

  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

  if (isLoading || !fontsLoaded) {
    return (
      <View style={styles.boot}>
        <LoadingState message="Starting SessionAI…" />
      </View>
    );
  }

  return children;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <StatusBar style="dark" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.ink,
                contentStyle: { backgroundColor: colors.background },
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen name="(app)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
