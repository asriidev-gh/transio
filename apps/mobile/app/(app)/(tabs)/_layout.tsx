import { Tabs } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';

/** Tab screens — chrome lives in the parent FloatingTabBar. */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="translate" options={{ title: 'Translate' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
    </Tabs>
  );
}
