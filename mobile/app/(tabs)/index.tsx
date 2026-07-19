import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, ErrorState, Header, LoadingState, Pill, Screen } from '@/components/ui';
import { formatMoney } from '@/lib/constants';
import { getMyTrips, getOpenTrips, getWallet } from '@/lib/api';
import { Trip, Wallet } from '@/lib/types';
import { colors, radius } from '@/lib/theme';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function HomeScreen() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const runner = profile?.active_role === 'runner';

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    try {
      const [tripData, walletData] = await Promise.all([runner ? getMyTrips(profile.id) : getOpenTrips(), getWallet(profile.id)]);
      setTrips(tripData); setWallet(walletData);
    } catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [profile, runner]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <LoadingState />;
  if (error) return <Screen><ErrorState message={error} retry={load} /></Screen>;

  return (
    <Screen>
      <Header eyebrow={runner ? 'RUNNER MODE' : 'RUNWISE'} title={`Hi, ${profile?.full_name.split(' ')[0]}`} subtitle={runner ? 'Turn your next journey into earnings.' : 'Someone is already going there. Let RunWise carry it.'} />
      {profile?.restricted && <Card style={styles.restricted}><Text style={styles.restrictedTitle}>Account restricted</Text><Text style={styles.muted}>You can manage existing orders, but cannot post new trips or requests.</Text></Card>}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>{runner ? 'YOUR EARNINGS' : 'YOUR NEXT RUN'}</Text>
        <Text style={styles.heroTitle}>{runner ? formatMoney(wallet?.available_balance) : 'Your Cart. Our Run.'}</Text>
        <Text style={styles.heroCopy}>{runner ? `${formatMoney(wallet?.pending_balance)} pending • RunScore ${profile?.run_score}` : 'Send shopping, parcels, documents and more across Botswana and the region.'}</Text>
        <AppButton title={runner ? 'Announce a trip' : 'Post a request'} disabled={!!profile?.restricted} onPress={() => router.push(runner ? '/trip/new' : '/request/new')} variant="secondary" />
      </View>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{runner ? 'Your recent trips' : 'Leaving soon'}</Text><Text style={styles.seeAll} onPress={() => router.push(runner ? '/(tabs)/activity' : '/(tabs)/explore')}>See all</Text></View>
      {trips.slice(0, 3).map((trip) => <TripPreview key={trip.id} trip={trip} />)}
      {!trips.length && <Card><Text style={styles.muted}>{runner ? 'You have not announced a trip yet.' : 'No trips are posted yet. Check again soon.'}</Text></Card>}
    </Screen>
  );
}

function TripPreview({ trip }: { trip: Trip }) {
  return (
    <Card>
      <View style={styles.row}><Pill text={trip.status} tone="success" /><Text style={styles.date}>{trip.depart_date} • {trip.depart_time.slice(0, 5)}</Text></View>
      <Text style={styles.route}>{trip.from_city} → {trip.to_city}</Text>
      <Text style={styles.muted}>{trip.from_country} to {trip.to_country} • {trip.spaces_remaining} spaces</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.green, borderRadius: radius.lg, padding: 22, gap: 10 },
  heroEyebrow: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.white, fontSize: 27, fontWeight: '900' },
  heroCopy: { color: '#DCE9E4', lineHeight: 21, marginBottom: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: colors.green, fontWeight: '900', fontSize: 18 },
  seeAll: { color: colors.gold, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  date: { color: colors.muted, fontSize: 12 },
  route: { color: colors.green, fontWeight: '900', fontSize: 19 },
  muted: { color: colors.muted, lineHeight: 20 },
  restricted: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  restrictedTitle: { color: colors.danger, fontWeight: '900' },
});
