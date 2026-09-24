import { Stack } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
    </Stack>
  );
}
