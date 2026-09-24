import { Stack } from 'expo-router';
import { SessionNavHeaderLeft } from '@/src/components/SessionNavHeaderLeft';
import { useTheme } from '@/src/theme/ThemeContext';

export default function SessionIdLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerBackVisible: false,
        headerLeft: () => <SessionNavHeaderLeft />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Session' }} />
      <Stack.Screen name="edit" options={{ title: 'Edit Session' }} />
      <Stack.Screen name="processing" options={{ title: 'Processing' }} />
      <Stack.Screen name="transcript" options={{ title: 'Transcript' }} />
      <Stack.Screen name="summary" options={{ title: 'AI Summary' }} />
    </Stack>
  );
}
