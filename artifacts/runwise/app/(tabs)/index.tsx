import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, ErrorState, Header, LoadingState, Pill, Screen } from '@/components/ui';
import { formatMoney } from '@/lib/constants';
import { getMyTrips, getOpenTrips, getWallet } from '@/lib/api';
import { Trip, Wallet } from '@/lib/types';
import { colors, radius } from '@/lib/theme';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

const CUSTOMER_TIPS = [
  { icon: '📅', title: 'Post early for more options', message: 'Post your request a few days before you need it. That gives upcoming runners more time to see and match your route.' },
  { icon: '🌱', title: 'RunWise is growing', message: 'A quiet trip board does not mean you did anything wrong. Keep your request posted and check again as new runners join.' },
  { icon: '🔒', title: 'Your contact details stay private', message: 'Your phone number is not shown publicly. During an active order, it can only be revealed when both parties are close enough for handover.' },
  { icon: '📍', title: 'Location sharing is controlled by you', message: 'RunWise does not track you continuously. Location is shared only when you choose Share location during an active handover.' },
  { icon: '📝', title: 'Clear details improve matching', message: 'Add useful landmarks, directions, item size and timing so a runner can quickly decide whether the request fits their journey.' },
  { icon: '🛡️', title: 'Keep the delivery PIN private', message: 'Give the PIN only after you have received and checked your delivery. It protects the final escrow release.' },
];

const RUNNER_TIPS = [
  { icon: '🗓️', title: 'Announce journeys in advance', message: 'Post an upcoming route a few days early. Customers then have more time to find your trip and prepare suitable requests.' },
  { icon: '🌱', title: 'Early runners help RunWise grow', message: 'RunWise is new, so some routes may be quiet at first. Keep genuine upcoming trips posted; matching opportunities can grow as customers join.' },
  { icon: '🚙', title: 'Keep vehicle details current', message: 'Use only the approved vehicle shown on your trip. Accurate capacity and space information helps customers choose safely.' },
  { icon: '🔒', title: 'Your number stays private', message: 'Your phone number is not displayed publicly. During an active order, it can only be revealed when both parties are close enough for handover.' },
  { icon: '📍', title: 'You control location sharing', message: 'RunWise does not track you continuously. Share your current location only from the active Order Room when coordinating a safe handover.' },
  { icon: '✅', title: 'Post honest milestones', message: 'Simple, timely updates reduce worry for customers and help build your rating and RunScore over time.' },
];

export default function HomeScreen() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Date.now() / 86_400_000));
  const runner = profile?.active_role === 'runner';
  const tips = runner ? RUNNER_TIPS : CUSTOMER_TIPS;
  const tip = tips[tipIndex % tips.length];

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    try {
      const [tripData, walletData] = await Promise.all([
        runner ? getMyTrips(profile.id) : getOpenTrips(),
        getWallet(profile.id),
      ]);
      setTrips(tripData); setWallet(walletData);
    } catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [profile, runner]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <LoadingState />;
  if (error) return <Screen><ErrorState message={error} retry={load} /></Screen>;

  return (
    <Screen>
      <Header
        eyebrow={runner ? 'RUNNER MODE' : 'RUNWISE'}
        title={`Hi, ${profile?.full_name.split(' ')[0]}`}
        subtitle={runner ? 'Turn your next journey into earnings.' : 'Someone is already going there. Let RunWise carry it.'}
      />
      {profile?.restricted && (
        <Card style={styles.restricted}>
          <Text style={styles.restrictedTitle}>Account restricted</Text>
          <Text style={styles.muted}>You can manage existing orders, but cannot post new trips or requests.</Text>
        </Card>
      )}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>{runner ? 'YOUR EARNINGS' : 'YOUR NEXT RUN'}</Text>
        <Text style={styles.heroTitle}>{runner ? formatMoney(wallet?.available_balance) : 'Your Cart. Our Run.'}</Text>
        <Text style={styles.heroCopy}>{runner ? `${formatMoney(wallet?.pending_balance)} pending • RunScore ${profile?.run_score}` : 'Send shopping, parcels, documents and more across Botswana and the region.'}</Text>
        <AppButton
          title={runner ? 'Announce a trip' : 'Post a request'}
          disabled={!!profile?.restricted}
          onPress={() => router.push(runner ? '/trip/new' : '/request/new')}
          variant="secondary"
        />
      </View>
      <Card style={styles.guide}>
        <View style={styles.guideTop}>
          <View style={styles.guideTitleWrap}>
            <Text style={styles.guideIcon}>{tip.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.guideEyebrow}>RUNWISE GUIDE</Text>
              <Text style={styles.guideTitle}>{tip.title}</Text>
            </View>
          </View>
          <Text style={styles.tipCount}>{(tipIndex % tips.length) + 1}/{tips.length}</Text>
        </View>
        <Text style={styles.guideMessage}>{tip.message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show next RunWise tip"
          onPress={() => setTipIndex((current) => current + 1)}
          style={({ pressed }) => [styles.nextTip, pressed && styles.nextTipPressed]}
        >
          <Text style={styles.nextTipText}>Next tip →</Text>
        </Pressable>
      </Card>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{runner ? 'Your recent trips' : 'Leaving soon'}</Text>
        <Text style={styles.seeAll} onPress={() => router.push(runner ? '/(tabs)/activity' : '/(tabs)/explore')}>See all</Text>
      </View>
      {trips.slice(0, 3).map((trip) => <TripPreview key={trip.id} trip={trip} />)}
      {!trips.length && (
        <Card><Text style={styles.muted}>{runner ? 'You have not announced a trip yet.' : 'No trips are posted yet. Check again soon.'}</Text></Card>
      )}
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
  heroEyebrow: { color: colors.gold, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.white, fontSize: 27, fontWeight: '900' },
  heroCopy: { color: '#DCE9E4', fontSize: 16, lineHeight: 24, marginBottom: 6 },
  guide: { backgroundColor: colors.goldSoft, borderColor: '#D4BE7A', gap: 11 },
  guideTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  guideTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  guideIcon: { fontSize: 28 },
  guideEyebrow: { color: colors.gold, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  guideTitle: { color: colors.green, fontSize: 19, lineHeight: 25, fontWeight: '900', marginTop: 2 },
  guideMessage: { color: colors.charcoal, fontSize: 16, lineHeight: 24 },
  tipCount: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  nextTip: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  nextTipPressed: { opacity: 0.6 },
  nextTipText: { color: colors.green, fontSize: 16, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: colors.green, fontWeight: '900', fontSize: 18 },
  seeAll: { color: colors.gold, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  date: { color: colors.charcoal, fontSize: 15, fontWeight: '700' },
  route: { color: colors.green, fontWeight: '900', fontSize: 23, lineHeight: 29 },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  restricted: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  restrictedTitle: { color: colors.danger, fontWeight: '900' },
});
