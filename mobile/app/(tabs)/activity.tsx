import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, EmptyState, ErrorState, Header, LoadingState, Pill, Screen } from '@/components/ui';
import { formatMoney, REQUEST_ICONS, titleCase } from '@/lib/constants';
import { getMyRequests, getMyTrips } from '@/lib/api';
import { RequestItem, Trip } from '@/lib/types';
import { colors } from '@/lib/theme';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function ActivityScreen() {
  const { profile } = useAuth();
  const runner = profile?.active_role === 'runner';
  const [items, setItems] = useState<Array<RequestItem | Trip>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    try { setItems(runner ? await getMyTrips(profile.id) : await getMyRequests(profile.id)); }
    catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [profile, runner]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <LoadingState />;
  if (error) return <Screen><ErrorState message={error} retry={load} /></Screen>;
  return (
    <Screen>
      <Header eyebrow={runner ? 'RUNNER' : 'CUSTOMER'} title={runner ? 'My trips' : 'My requests'} subtitle={runner ? 'Manage the journeys you have announced.' : 'Track everything you have asked a runner to carry or buy.'} action={<AppButton title={runner ? '+ Trip' : '+ Request'} variant="secondary" disabled={!!profile?.restricted} onPress={() => router.push(runner ? '/trip/new' : '/request/new')} />} />
      {items.length ? items.map((item) => runner ? <TripItem key={item.id} trip={item as Trip} /> : <RequestCard key={item.id} request={item as RequestItem} />) : <EmptyState icon={runner ? '🚙' : '📦'} title={runner ? 'No trips announced' : 'No requests posted'} message={runner ? 'Announce your route and RunWise will find requests along the way.' : 'Post your first request and let a runner bring it.'} />}
    </Screen>
  );
}

function RequestCard({ request }: { request: RequestItem }) {
  return <Card><View style={styles.row}><Text style={styles.icon}>{REQUEST_ICONS[request.type]}</Text><Pill text={request.status} tone={request.status === 'open' ? 'warning' : 'success'} /></View><Text style={styles.route}>{request.from_city} → {request.to_city}</Text><Text style={styles.muted}>{titleCase(request.type)} • {formatMoney(request.estimated_value)}</Text>{!!request.details && <Text style={styles.details}>{request.details}</Text>}</Card>;
}

function TripItem({ trip }: { trip: Trip }) {
  return <Card><View style={styles.row}><Pill text={trip.status} tone="success" /><Text style={styles.date}>{trip.depart_date} • {trip.depart_time.slice(0, 5)}</Text></View><Text style={styles.route}>{trip.from_city} → {trip.to_city}</Text><Text style={styles.muted}>{trip.spaces_remaining}/{trip.capacity_spaces} spaces • {trip.capacity_kg} kg • Potential {formatMoney(trip.potential_earnings)}</Text><View style={styles.pills}>{trip.services.map((service) => <Pill key={service} text={titleCase(service)} />)}</View></Card>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  icon: { fontSize: 27 },
  route: { color: colors.green, fontWeight: '900', fontSize: 23, lineHeight: 29 },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  details: { color: colors.charcoal, fontSize: 16, lineHeight: 24 },
  date: { color: colors.charcoal, fontSize: 15, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
