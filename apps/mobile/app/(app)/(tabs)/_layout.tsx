import { Tabs } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';

/** Tab screens — chrome lives in the parent FloatingTabBar (always visible). */
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
      <Tabs.Screen name="favorites" options={{ title: 'Favorites' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
