import { Redirect, Tabs } from 'expo-router';
import { ColorValue, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { LoadingState } from '@/components/ui';

const icon = (value: string, color: ColorValue) => <Text style={{ color, fontSize: 22 }}>{value}</Text>;

export default function TabsLayout() {
  const { session, profile, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading || (session && !profile)) return <LoadingState />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  const runner = profile?.active_role === 'runner';
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarActiveTintColor: colors.green,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: {
        backgroundColor: colors.white,
        borderTopColor: colors.border,
        height: 64 + insets.bottom,
        paddingTop: 7,
        paddingBottom: Math.max(insets.bottom, 10),
      },
      tabBarItemStyle: { minHeight: 54 },
      tabBarLabelStyle: { fontWeight: '800', fontSize: 12 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => icon('⌂', color) }} />
      <Tabs.Screen name="explore" options={{ title: runner ? 'Matches' : 'Explore', tabBarIcon: ({ color }) => icon(runner ? '🤝' : '⊙', color) }} />
      <Tabs.Screen name="activity" options={{ title: runner ? 'My trips' : 'Requests', tabBarIcon: ({ color }) => icon(runner ? '🚙' : '📦', color) }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color }) => icon('◎', color) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => icon('●', color) }} />
    </Tabs>
  );
}
