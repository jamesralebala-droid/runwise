import { Redirect } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';

export default function Index() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <LoadingState />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)" />;
}
