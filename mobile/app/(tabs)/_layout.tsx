import { Redirect, Tabs } from 'expo-router';
import { ColorValue, Text } from 'react-native';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { LoadingState } from '@/components/ui';

const icon = (value: string, color: ColorValue) => <Text style={{ color, fontSize: 20 }}>{value}</Text>;

export default function TabsLayout() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <LoadingState />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  const runner = profile?.active_role === 'runner';
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.green,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border, height: 68, paddingTop: 6, paddingBottom: 8 },
      tabBarLabelStyle: { fontWeight: '700', fontSize: 10 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => icon('⌂', color) }} />
      <Tabs.Screen name="explore" options={{ title: runner ? 'Matches' : 'Explore', tabBarIcon: ({ color }) => icon(runner ? '🤝' : '⌕', color) }} />
      <Tabs.Screen name="activity" options={{ title: runner ? 'My trips' : 'Requests', tabBarIcon: ({ color }) => icon(runner ? '🚙' : '📦', color) }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color }) => icon('◉', color) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => icon('●', color) }} />
    </Tabs>
  );
}
