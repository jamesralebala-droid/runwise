import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, EmptyState, ErrorState, Header, LoadingState, Pill, Screen } from '@/components/ui';
import { formatMoney, REQUEST_ICONS, titleCase } from '@/lib/constants';
import { getCustomerMatches, getMyTrips, getOpenRequests, getOpenTrips } from '@/lib/api';
import { MatchOffer, RequestItem, Trip } from '@/lib/types';
import { colors, radius } from '@/lib/theme';
import { friendlyError, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function ExploreScreen() {
  const { profile } = useAuth();
  const runner = profile?.active_role === 'runner';
  return runner ? <RunnerMatches /> : <CustomerExplore />;
}

function CustomerExplore() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'trips' | 'offers'>('trips');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [offers, setOffers] = useState<MatchOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    try { const [t, m] = await Promise.all([getOpenTrips(), getCustomerMatches(profile.id)]); setTrips(t); setOffers(m); }
    catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [profile]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    const result = await supabase.rpc(accept ? 'accept_match' : 'decline_match', { p_match_id: id });
    setBusy('');
    if (result.error) return Alert.alert('Could not update offer', friendlyError(result.error));
    if (accept) Alert.alert('Offer accepted', 'Your Order Room is ready when both sides have accepted.');
    load();
  };
  if (loading) return <LoadingState />;
  if (error) return <Screen><ErrorState message={error} retry={load} /></Screen>;
  const activeOffers = offers.filter((offer) => !['declined', 'cancelled', 'completed'].includes(offer.status));
  return (
    <Screen>
      <Header eyebrow="CUSTOMER" title="Find a run" subtitle="Browse journeys or review offers from runners." />
      <View style={styles.segment}>
        <Segment active={tab === 'trips'} label="Trip board" onPress={() => setTab('trips')} />
        <Segment active={tab === 'offers'} label={`Offers (${activeOffers.length})`} onPress={() => setTab('offers')} />
      </View>
      {tab === 'trips' ? (
        trips.length ? trips.map((trip) => <TripCard key={trip.id} trip={trip} />) : <EmptyState title="No trips yet" message="New journeys will appear here as runners announce them." />
      ) : (
        activeOffers.length ? activeOffers.map((offer) => (
          <Card key={offer.id}>
            <View style={styles.row}><Text style={styles.icon}>{REQUEST_ICONS[offer.requests?.type || 'parcel']}</Text><Pill text={offer.status} tone="warning" /></View>
            <Text style={styles.route}>{offer.requests?.from_city || offer.trips?.from_city} → {offer.requests?.to_city || offer.trips?.to_city}</Text>
            <Text style={styles.muted}>{titleCase(offer.requests?.type || 'request')} • {formatMoney(offer.requests?.estimated_value)}</Text>
            <Text style={styles.muted}>Travel: {offer.trips?.depart_date} at {offer.trips?.depart_time?.slice(0, 5)}</Text>
            {['proposed', 'accepted_by_runner'].includes(offer.status) && (
              <View style={styles.actions}>
                <AppButton title="Decline" variant="secondary" onPress={() => respond(offer.id, false)} loading={busy === offer.id} style={{ flex: 1 }} />
                <AppButton title="Accept offer" onPress={() => respond(offer.id, true)} loading={busy === offer.id} style={{ flex: 1 }} />
              </View>
            )}
          </Card>
        )) : <EmptyState icon="🤝" title="No offers yet" message="When a runner proposes a match for one of your requests, it will appear here." />
      )}
    </Screen>
  );
}

function RunnerMatches() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    try { const [r, t] = await Promise.all([getOpenRequests(), getMyTrips(profile.id)]); setRequests(r); setTrips(t); }
    catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [profile]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const compatible = useMemo(() =>
    requests.map((request) => ({
      request,
      trip: trips.find((trip) =>
        trip.from_city.toLowerCase() === request.from_city.toLowerCase() &&
        trip.to_city.toLowerCase() === request.to_city.toLowerCase()
      ),
    })).filter((match) => match.trip),
    [requests, trips]);
  const propose = async (requestId: string, tripId: string) => {
    setBusy(requestId);
    const { error: rpcError } = await supabase.rpc('propose_match', { p_trip_id: tripId, p_request_id: requestId });
    setBusy('');
    if (rpcError) return Alert.alert('Could not send offer', friendlyError(rpcError));
    Alert.alert('Offer sent', 'The customer can now accept or decline it.');
    load();
  };
  if (loading) return <LoadingState />;
  if (error) return <Screen><ErrorState message={error} retry={load} /></Screen>;
  return (
    <Screen>
      <Header
        eyebrow="SMART MATCHES"
        title="Requests on your route"
        subtitle="Only requests matching your announced start and destination are shown."
        action={<AppButton title="+ Trip" onPress={() => router.push('/trip/new')} variant="secondary" />}
      />
      {compatible.length ? compatible.map(({ request, trip }) => (
        <Card key={request.id}>
          <View style={styles.row}><Text style={styles.icon}>{REQUEST_ICONS[request.type]}</Text><Pill text="Smart match" tone="gold" /></View>
          <Text style={styles.route}>{request.from_city} → {request.to_city}</Text>
          <Text style={styles.muted}>{titleCase(request.type)} • Item value {formatMoney(request.estimated_value)}</Text>
          {!!request.details && <Text style={styles.details}>{request.details}</Text>}
          <AppButton title="Propose match" onPress={() => propose(request.id, trip!.id)} loading={busy === request.id} />
        </Card>
      )) : (
        <EmptyState
          icon="🧭"
          title="No matching requests"
          message={trips.length ? 'There are no open requests along your announced routes yet.' : 'Announce a trip first so RunWise can find requests along your route.'}
          action={!trips.length ? <AppButton title="Announce a trip" onPress={() => router.push('/trip/new')} /> : undefined}
        />
      )}
    </Screen>
  );
}

function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.segmentItem, active && styles.segmentActive]}><Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text></Pressable>;
}

function TripCard({ trip }: { trip: Trip }) {
  const rating = trip.profiles?.rating_count ? (trip.profiles.rating_sum / trip.profiles.rating_count).toFixed(1) : 'New';
  return (
    <Card>
      <View style={styles.row}><Pill text={trip.status} tone="success" /><Text style={styles.date}>{trip.depart_date} • {trip.depart_time.slice(0, 5)}</Text></View>
      <Text style={styles.route}>{trip.from_city} → {trip.to_city}</Text>
      <Text style={styles.muted}>{trip.profiles?.full_name || 'Runner'} • ★ {rating} • {trip.capacity_kg} kg</Text>
      <AppButton title="Match a request" variant="secondary" onPress={() => router.push({ pathname: '/request/new', params: { from: trip.from_city, to: trip.to_city } })} />
    </Card>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: '#E9E4D9', padding: 4, borderRadius: radius.sm },
  segmentItem: { flex: 1, minHeight: 48, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
  segmentTextActive: { color: colors.green, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  icon: { fontSize: 27 },
  route: { color: colors.green, fontWeight: '900', fontSize: 23, lineHeight: 29 },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  details: { color: colors.charcoal, fontSize: 16, lineHeight: 24, backgroundColor: colors.ivory, padding: 12, borderRadius: radius.sm },
  date: { color: colors.charcoal, fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
});
