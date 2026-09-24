import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FloatingTabBar } from '@/src/components/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeContext';

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.ink,
            contentStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="new-session" options={{ title: 'New session' }} />
          <Stack.Screen name="folder/[id]" options={{ title: 'Folder' }} />
          <Stack.Screen name="recording" options={{ title: 'Recording', headerBackVisible: true }} />
          <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="help" options={{ headerShown: false }} />
          <Stack.Screen name="help-contact" options={{ title: 'Send a message' }} />
          <Stack.Screen name="about" options={{ title: 'About us' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy policy' }} />
          <Stack.Screen name="terms" options={{ title: 'Terms of service' }} />
          <Stack.Screen name="voice-translate" options={{ title: 'Voice translate' }} />
        </Stack>
      </View>
      <FloatingTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stack: {
    flex: 1,
  },
});
