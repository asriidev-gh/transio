import { Stack } from 'expo-router';
import { colors } from '@/src/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'SessionAI', headerShown: false }} />
      <Stack.Screen name="new-session" options={{ title: 'New Session' }} />
      <Stack.Screen name="recording" options={{ title: 'Recording', headerBackVisible: true }} />
      <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
