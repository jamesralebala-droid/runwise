import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, EmptyState, ErrorState, Field, LoadingState, Pill, Screen } from '@/components/ui';
import { DISPUTE_REASONS, formatMoney, MILESTONES, titleCase } from '@/lib/constants';
import { recordAcceptance } from '@/lib/api';
import { Escrow, OrderRoom } from '@/lib/types';
import { colors, radius } from '@/lib/theme';
import { friendlyError, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type Message = { id: string; sender_id: string; message: string; created_at: string };
type Milestone = { id: string; milestone: string; note: string | null; created_at: string };

export default function OrderRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [room, setRoom] = useState<OrderRoom | null>(null);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [dispute, setDispute] = useState<any>(null);
  const [myRating, setMyRating] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [milestone, setMilestone] = useState('journey_started');
  const [pin, setPin] = useState('');
  const [deliveryPin, setDeliveryPin] = useState('');
  const [actualSpent, setActualSpent] = useState('');
  const [paymentsAccepted, setPaymentsAccepted] = useState(false);
  const [refundsAccepted, setRefundsAccepted] = useState(false);
  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeDetails, setDisputeDetails] = useState('');
  const [stars, setStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [nearby, setNearby] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!id || !profile) return;
    setError('');
    try {
      const [roomResult, milestoneResult, messageResult, disputeResult, ratingResult] = await Promise.all([
        supabase.from('order_rooms').select('*, escrow_transactions(*)').eq('id', id).single(),
        supabase.from('journey_milestones').select('*').eq('order_room_id', id).order('created_at'),
        supabase.from('order_messages').select('*').eq('order_room_id', id).order('created_at'),
        supabase.from('disputes').select('*').eq('order_room_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('ratings').select('*').eq('order_room_id', id).eq('rater_id', profile.id).maybeSingle(),
      ]);
      const firstError = roomResult.error || milestoneResult.error || messageResult.error;
      if (firstError) throw firstError;
      const roomData = roomResult.data as unknown as OrderRoom;
      const rawEscrow = (roomResult.data as any).escrow_transactions;
      setRoom(roomData);
      setEscrow((Array.isArray(rawEscrow) ? rawEscrow[0] : rawEscrow) || null);
      setMilestones((milestoneResult.data || []) as Milestone[]);
      setMessages((messageResult.data || []) as Message[]);
      setDispute(disputeResult.data);
      setMyRating(ratingResult.data);
    } catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [id, profile]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_messages', filter: `order_room_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journey_milestones', filter: `order_room_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  const run = async (key: string, action: () => Promise<void>, success?: string) => {
    setBusy(key);
    try { await action(); if (success) Alert.alert('Done', success); await load(); }
    catch (err) { Alert.alert('Action failed', friendlyError(err)); }
    finally { setBusy(''); }
  };

  if (loading) return <LoadingState />;
  if (error) return <Screen><ErrorState message={error} retry={load} /></Screen>;
  if (!room || !profile) return <Screen><EmptyState title="Order not found" message="This Order Room is unavailable." /></Screen>;
  const isCustomer = room.customer_id === profile.id;
  const isDisputed = escrow?.status === 'disputed';
  const active = !!escrow?.status && !['awaiting_funding', 'released', 'refunded', 'partially_refunded', 'cancelled'].includes(escrow.status);
  const settled = ['released', 'refunded', 'partially_refunded'].includes(escrow?.status || '');

  const sendMessage = () => {
    if (!message.trim()) return;
    run('message', async () => {
      const { error: sendError } = await supabase.from('order_messages').insert({ order_room_id: id, sender_id: profile.id, message: message.trim() });
      if (sendError) throw sendError;
      setMessage('');
    });
  };
  const postMilestone = () => run('milestone', async () => {
    const { error: rpcError } = await supabase.rpc('add_milestone', { p_order_room_id: id, p_milestone: milestone });
    if (rpcError) throw rpcError;
  }, 'Journey milestone posted.');
  const fundEscrow = () => {
    if (!paymentsAccepted || !refundsAccepted) return Alert.alert('Policies required', 'Accept both the Payments and Refund policies before funding escrow.');
    run('fund', async () => {
      await recordAcceptance(profile.id, profile.active_role, 'payments_escrow', 'escrow_funding', id);
      await recordAcceptance(profile.id, profile.active_role, 'refunds_cancellations', 'escrow_funding', id);
      const { error: rpcError } = await supabase.rpc('fund_escrow', { p_order_room_id: id, p_method: 'demo_card' });
      if (rpcError) throw rpcError;
    }, 'Escrow funded using the current demo payment method.');
  };
  const savePin = () => {
    if (!/^\d{4,6}$/.test(pin)) return Alert.alert('Invalid PIN', 'Use a private 4–6 digit PIN.');
    run('pin', async () => { const { error: rpcError } = await supabase.rpc('set_delivery_pin', { p_order_room_id: id, p_pin: pin }); if (rpcError) throw rpcError; setPin(''); }, 'Delivery PIN saved. Keep it private until you receive the delivery.');
  };
  const confirmDelivery = () => {
    if (!/^\d{4,6}$/.test(deliveryPin)) return Alert.alert('PIN required', 'Enter your 4–6 digit delivery PIN.');
    Alert.alert('Confirm delivery?', 'This releases escrow after the server validates your PIN.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm and release', onPress: () => run('delivery', async () => { const { error: rpcError } = await supabase.rpc('confirm_delivery', { p_order_room_id: id, p_pin: deliveryPin, p_actual_spent: actualSpent ? Number(actualSpent) : null }); if (rpcError) throw rpcError; }, 'Delivery confirmed and escrow released.') }]);
  };
  const raiseDispute = () => {
    if (!disputeDetails.trim()) return Alert.alert('Add details', 'Briefly explain what happened.');
    Alert.alert('Raise dispute?', 'Escrow will be frozen while an administrator reviews the order.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Raise dispute', style: 'destructive', onPress: () => run('dispute', async () => { const { error: rpcError } = await supabase.rpc('raise_dispute', { p_order_room_id: id, p_reason: disputeReason, p_evidence: { details: disputeDetails.trim() } }); if (rpcError) throw rpcError; }, 'Dispute raised. Escrow is now frozen.') }]);
  };
  const shareLocation = () => run('location', async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Location permission was not granted.');
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { error: locationError } = await supabase.from('live_locations').upsert({ order_room_id: id, user_id: profile.id, latitude: current.coords.latitude, longitude: current.coords.longitude, updated_at: new Date().toISOString() }, { onConflict: 'order_room_id,user_id' });
    if (locationError) throw locationError;
  }, 'Your location was shared for this active order.');
  const checkNearby = () => run('nearby', async () => {
    const { data, error: rpcError } = await supabase.rpc('get_nearby_contact', { p_order_room_id: id });
    if (rpcError) throw rpcError;
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.distance_meters == null) setNearby('Waiting for both parties to share their location.');
    else if (result.revealed) setNearby(`You are ${Math.round(result.distance_meters)}m apart. Contact: ${result.phone || 'not on file'}`);
    else setNearby(`You are still ${Math.round(result.distance_meters)}m apart. The phone number remains private.`);
  });
  const submitRating = () => run('rating', async () => {
    const rateeId = isCustomer ? room.runner_id : room.customer_id;
    const { error: ratingError } = await supabase.from('ratings').insert({ order_room_id: id, rater_id: profile.id, ratee_id: rateeId, stars, areas: {}, comment: ratingComment.trim() || null });
    if (ratingError) throw ratingError;
  }, 'Thank you for rating this order.');

  return (
    <Screen>
      <View style={styles.headingRow}><View><Text style={styles.eyebrow}>ORDER {id.slice(0, 8).toUpperCase()}</Text><Text style={styles.heading}>Order Room</Text></View><Pill text={titleCase(escrow?.status || 'pending')} tone={isDisputed ? 'danger' : settled ? 'success' : 'warning'} /></View>
      <Card>
        <Text style={styles.title}>Escrow</Text>
        <MoneyRow label="Item value" value={escrow?.item_value} /><MoneyRow label="Runner fee" value={escrow?.runner_fee} /><MoneyRow label="Platform fee" value={escrow?.platform_fee} /><MoneyRow label="Protection fee" value={escrow?.protection_fee} />
        <View style={styles.total}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{formatMoney(escrow?.total)}</Text></View>
        {isCustomer && escrow?.status === 'awaiting_funding' && <>
          <CheckRow checked={paymentsAccepted} onPress={() => setPaymentsAccepted(!paymentsAccepted)} text="I accept the Payments and Escrow Policy." />
          <CheckRow checked={refundsAccepted} onPress={() => setRefundsAccepted(!refundsAccepted)} text="I accept the Refund and Cancellation Policy." />
          <AppButton title="Fund escrow (demo payment)" onPress={fundEscrow} loading={busy === 'fund'} />
        </>}
      </Card>
      <Card>
        <Text style={styles.title}>Journey timeline</Text>
        {milestones.map((item, index) => <View key={item.id} style={styles.timeline}><View style={styles.dot}><Text style={styles.dotText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.timelineTitle}>{MILESTONES[item.milestone] || titleCase(item.milestone)}</Text><Text style={styles.small}>{new Date(item.created_at).toLocaleString()}{item.note ? ` • ${item.note}` : ''}</Text></View></View>)}
        {!milestones.length && <Text style={styles.muted}>No milestones posted yet.</Text>}
        {!isCustomer && !isDisputed && <><Text style={styles.label}>Post milestone</Text><View style={styles.choiceWrap}>{Object.entries(MILESTONES).map(([value, label]) => <Pressable key={value} onPress={() => setMilestone(value)} style={[styles.choice, milestone === value && styles.choiceActive]}><Text style={[styles.choiceText, milestone === value && styles.choiceTextActive]}>{label}</Text></Pressable>)}</View><AppButton title="Post milestone" variant="secondary" onPress={postMilestone} loading={busy === 'milestone'} /></>}
      </Card>
      <Card>
        <Text style={styles.title}>Order chat</Text>
        {messages.map((item) => <View key={item.id} style={[styles.bubble, item.sender_id === profile.id ? styles.mine : styles.theirs]}><Text style={styles.bubbleName}>{item.sender_id === profile.id ? 'You' : 'Other party'}</Text><Text style={styles.bubbleText}>{item.message}</Text><Text style={styles.bubbleTime}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>)}
        <Field label="Message" value={message} onChangeText={setMessage} placeholder="Type a message…" />
        <AppButton title="Send" onPress={sendMessage} loading={busy === 'message'} />
      </Card>
      {active && <Card>
        <Text style={styles.title}>Safe handover</Text><Text style={styles.muted}>Both parties share their current location. A phone number is revealed by the server only when you are close enough.</Text>
        <View style={styles.actionRow}><AppButton title="Share location" variant="secondary" onPress={shareLocation} loading={busy === 'location'} style={{ flex: 1 }} /><AppButton title="Check distance" variant="secondary" onPress={checkNearby} loading={busy === 'nearby'} style={{ flex: 1 }} /></View>
        {!!nearby && <Text style={styles.nearby}>{nearby}</Text>}
      </Card>}
      {isCustomer && active && !isDisputed && <Card>
        <Text style={styles.title}>Delivery PIN</Text><Text style={styles.muted}>Create a private PIN and enter it only after you receive the delivery.</Text>
        <Field label="Create PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} secureTextEntry />
        <AppButton title="Save PIN" variant="secondary" onPress={savePin} loading={busy === 'pin'} />
        <Field label="Confirm delivery PIN" value={deliveryPin} onChangeText={setDeliveryPin} keyboardType="number-pad" maxLength={6} secureTextEntry />
        <Field label="Actual amount spent (shopping only)" value={actualSpent} onChangeText={setActualSpent} keyboardType="decimal-pad" />
        <AppButton title="Confirm delivery and release escrow" onPress={confirmDelivery} loading={busy === 'delivery'} />
      </Card>}
      {dispute ? <Card style={styles.dispute}><View style={styles.headingRow}><Text style={styles.title}>Dispute</Text><Pill text={dispute.status} tone={dispute.status === 'resolved' ? 'success' : 'danger'} /></View><Text style={styles.muted}><Text style={styles.bold}>Reason: </Text>{dispute.reason}</Text><Text style={styles.muted}>{dispute.status === 'resolved' ? `Resolution: ${dispute.resolution || 'Completed'}` : 'Escrow is frozen while an administrator reviews this order.'}</Text></Card> : active && <Card>
        <Text style={styles.title}>Something wrong?</Text><Text style={styles.label}>Dispute reason</Text><View style={styles.choiceWrap}>{DISPUTE_REASONS.map((reason) => <Pressable key={reason} onPress={() => setDisputeReason(reason)} style={[styles.choice, disputeReason === reason && styles.choiceDanger]}><Text style={[styles.choiceText, disputeReason === reason && styles.choiceDangerText]}>{reason}</Text></Pressable>)}</View><Field label="What happened?" value={disputeDetails} onChangeText={setDisputeDetails} multiline /><AppButton title="Raise a dispute" variant="danger" onPress={raiseDispute} loading={busy === 'dispute'} />
      </Card>}
      {settled && <Card>
        <Text style={styles.title}>Rate {isCustomer ? 'your runner' : 'your customer'}</Text>
        {myRating ? <Text style={styles.muted}>You rated this order {myRating.stars}/5. Thank you.</Text> : <><View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setStars(value)}><Text style={[styles.star, value <= stars && styles.starActive]}>★</Text></Pressable>)}</View><Field label="Comment (optional)" value={ratingComment} onChangeText={setRatingComment} multiline /><AppButton title="Submit rating" onPress={submitRating} loading={busy === 'rating'} /></>}
      </Card>}
    </Screen>
  );
}

function MoneyRow({ label, value }: { label: string; value: number | undefined }) { return <View style={styles.moneyRow}><Text style={styles.muted}>{label}</Text><Text style={styles.money}>{formatMoney(value)}</Text></View>; }
function CheckRow({ checked, onPress, text }: { checked: boolean; onPress: () => void; text: string }) { return <Pressable onPress={onPress} style={styles.checkRow}><View style={[styles.checkbox, checked && styles.checkboxActive]}><Text style={styles.check}>{checked ? '✓' : ''}</Text></View><Text style={styles.checkText}>{text}</Text></Pressable>; }

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  eyebrow: { color: colors.gold, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  heading: { color: colors.green, fontSize: 25, fontWeight: '900' },
  title: { color: colors.green, fontSize: 18, fontWeight: '900' },
  bold: { fontWeight: '900', color: colors.charcoal },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  small: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
  label: { color: colors.charcoal, fontWeight: '800', fontSize: 15 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  money: { color: colors.charcoal, fontWeight: '700', fontSize: 16 },
  total: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { color: colors.green, fontWeight: '900', fontSize: 17 },
  totalValue: { color: colors.green, fontWeight: '900', fontSize: 24 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  checkbox: { width: 23, height: 23, borderWidth: 1, borderColor: colors.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.green, borderColor: colors.green },
  check: { color: colors.white, fontWeight: '900' },
  checkText: { flex: 1, color: colors.charcoal, fontSize: 16, lineHeight: 23 },
  timeline: { flexDirection: 'row', gap: 12, paddingVertical: 7 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: colors.white, fontWeight: '900', fontSize: 14 },
  timelineTitle: { color: colors.charcoal, fontWeight: '800', fontSize: 17, lineHeight: 23 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { minHeight: 44, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 13, justifyContent: 'center', backgroundColor: colors.ivory, borderWidth: 1, borderColor: colors.border },
  choiceActive: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  choiceDanger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  choiceText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  choiceTextActive: { color: colors.green },
  choiceDangerText: { color: colors.danger },
  bubble: { maxWidth: '86%', borderRadius: radius.sm, padding: 10, gap: 3 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.greenSoft },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.ivory },
  bubbleName: { color: colors.green, fontSize: 13, fontWeight: '900' },
  bubbleText: { color: colors.charcoal, fontSize: 16, lineHeight: 23 },
  bubbleTime: { color: colors.muted, fontSize: 13, alignSelf: 'flex-end' },
  actionRow: { flexDirection: 'row', gap: 8 },
  nearby: { backgroundColor: colors.goldSoft, borderRadius: radius.sm, padding: 13, color: colors.charcoal, fontSize: 16, lineHeight: 23 },
  dispute: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  star: { color: colors.border, fontSize: 36 },
  starActive: { color: colors.gold },
});
