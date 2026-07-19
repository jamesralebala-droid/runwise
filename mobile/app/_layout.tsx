import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{
            headerStyle: { backgroundColor: colors.ivory },
            headerTintColor: colors.green,
            headerTitleStyle: { fontWeight: '800' },
            contentStyle: { backgroundColor: colors.ivory },
          }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="request/new" options={{ title: 'Post a request', presentation: 'modal' }} />
            <Stack.Screen name="trip/new" options={{ title: 'Announce a trip', presentation: 'modal' }} />
            <Stack.Screen name="order/[id]" options={{ title: 'Order Room' }} />
            <Stack.Screen name="verification" options={{ title: 'Runner verification' }} />
            <Stack.Screen name="vehicles" options={{ title: 'My vehicles' }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
