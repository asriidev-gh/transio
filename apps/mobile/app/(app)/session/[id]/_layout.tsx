import { Stack } from 'expo-router';
import { colors } from '@/src/theme';

export default function SessionIdLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Session' }} />
      <Stack.Screen name="processing" options={{ title: 'Processing' }} />
      <Stack.Screen name="transcript" options={{ title: 'Transcript' }} />
      <Stack.Screen name="summary" options={{ title: 'AI Summary' }} />
    </Stack>
  );
}
