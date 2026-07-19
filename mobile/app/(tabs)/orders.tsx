import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, EmptyState, ErrorState, Header, LoadingState, Pill, Screen } from '@/components/ui';
import { formatMoney, titleCase } from '@/lib/constants';
import { getOrders } from '@/lib/api';
import { OrderRoom } from '@/lib/types';
import { colors } from '@/lib/theme';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function OrdersScreen() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    try { setOrders(await getOrders(profile.id, profile.active_role)); }
    catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [profile]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <LoadingState />;
  if (error) return <Screen><ErrorState message={error} retry={load} /></Screen>;
  return (
    <Screen>
      <Header eyebrow="ORDER ROOMS" title="My orders" subtitle="Payment, chat, live milestones and delivery confirmation stay together here." />
      {orders.length ? orders.map((order) => {
        const escrow = order.escrow_transactions;
        const settled = ['released', 'refunded', 'partially_refunded'].includes(escrow?.status || '');
        return <Card key={order.id}><View style={styles.row}><Text style={styles.orderNumber}>Order {order.id.slice(0, 8).toUpperCase()}</Text><Pill text={titleCase(escrow?.status || 'pending')} tone={settled ? 'success' : escrow?.status === 'disputed' ? 'danger' : 'warning'} /></View><View style={styles.totalRow}><Text style={styles.muted}>Order total</Text><Text style={styles.total}>{formatMoney(escrow?.total)}</Text></View><AppButton title="Open Order Room" onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })} /></Card>;
      }) : <EmptyState icon="📍" title="No active orders" message="Your Order Room appears after a match offer is accepted." />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderNumber: { color: colors.green, fontWeight: '900', fontSize: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  total: { color: colors.green, fontWeight: '900', fontSize: 22 },
});
