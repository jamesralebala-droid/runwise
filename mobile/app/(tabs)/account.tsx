import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, ErrorState, Field, Header, LoadingState, Pill, Screen } from '@/components/ui';
import { formatMoney, titleCase } from '@/lib/constants';
import { getVerification, getVehicles, getWallet, getWalletTransactions } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { friendlyError, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { UserRole, Vehicle, Wallet } from '@/lib/types';

export default function AccountScreen() {
  const { profile, switchRole, signOut } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [verification, setVerification] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'orange_money' | 'myzaka' | 'bank_transfer'>('orange_money');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const runner = profile?.active_role === 'runner';

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    try {
      const [walletData, verificationData, vehicleData] = await Promise.all([getWallet(profile.id), getVerification(profile.id), getVehicles(profile.id)]);
      setWallet(walletData); setVerification(verificationData); setVehicles(vehicleData);
      setTransactions(walletData ? await getWalletTransactions(walletData.id) : []);
    } catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [profile]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeRole = async (role: UserRole) => {
    setBusy(true);
    try { await switchRole(role); }
    catch (err) { Alert.alert('Could not switch mode', friendlyError(err)); }
    finally { setBusy(false); }
  };

  const withdraw = async () => {
    const value = Number(withdrawAmount);
    if (!value || value <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('request_withdrawal', { p_amount: value, p_method: withdrawMethod });
    setBusy(false);
    if (rpcError) return Alert.alert('Withdrawal failed', friendlyError(rpcError));
    setWithdrawAmount('');
    Alert.alert('Request received', 'This remains a demo withdrawal until the real payment rail is connected.');
    load();
  };

  if (loading) return <LoadingState />;
  if (error) return <Screen><ErrorState message={error} retry={load} /></Screen>;
  const rating = profile?.rating_count ? (profile.rating_sum / profile.rating_count).toFixed(1) : 'New';
  return (
    <Screen>
      <Header eyebrow={runner ? 'RUNNER ACCOUNT' : 'CUSTOMER ACCOUNT'} title={profile?.full_name || 'Account'} subtitle={`★ ${rating} • RunScore ${profile?.run_score} • ${titleCase(profile?.run_score_level || 'bronze')}`} />
      <Card>
        <Text style={styles.sectionTitle}>Choose mode</Text>
        <View style={styles.modeRow}>
          <ModeButton title="🛍️ Customer" active={!runner} disabled={busy} onPress={() => changeRole('customer')} />
          <ModeButton title="🚙 Runner" active={runner} disabled={busy} onPress={() => changeRole('runner')} />
        </View>
      </Card>
      <View style={styles.balanceRow}>
        <Card style={styles.balanceCard}><Text style={styles.muted}>Available</Text><Text style={styles.balance}>{formatMoney(wallet?.available_balance)}</Text></Card>
        <Card style={styles.balanceCard}><Text style={styles.muted}>Pending</Text><Text style={styles.balance}>{formatMoney(wallet?.pending_balance)}</Text></Card>
      </View>
      {runner && <Card>
        <View style={styles.row}><Text style={styles.sectionTitle}>Runner setup</Text><Pill text={verification?.status || 'not submitted'} tone={verification?.status === 'approved' ? 'success' : verification?.status === 'rejected' ? 'danger' : 'warning'} /></View>
        <Text style={styles.muted}>{vehicles.filter((vehicle) => vehicle.approved).length} approved vehicle(s)</Text>
        <View style={styles.modeRow}><AppButton title="Verification" variant="secondary" onPress={() => router.push('/verification')} style={{ flex: 1 }} /><AppButton title="Vehicles" variant="secondary" onPress={() => router.push('/vehicles')} style={{ flex: 1 }} /></View>
      </Card>}
      {runner && <Card>
        <Text style={styles.sectionTitle}>Withdraw earnings</Text>
        <Field label="Amount (P)" value={withdrawAmount} onChangeText={setWithdrawAmount} keyboardType="decimal-pad" placeholder="0.00" />
        <View style={styles.methodRow}>{[
          ['orange_money', 'Orange Money'], ['myzaka', 'MyZaka'], ['bank_transfer', 'Bank transfer'],
        ].map(([value, label]) => <Pressable key={value} onPress={() => setWithdrawMethod(value as typeof withdrawMethod)} style={[styles.method, withdrawMethod === value && styles.methodActive]}><Text style={[styles.methodText, withdrawMethod === value && styles.methodTextActive]}>{label}</Text></Pressable>)}</View>
        <AppButton title="Request withdrawal" onPress={withdraw} variant="secondary" loading={busy} />
        <Text style={styles.muted}>Demo only until a real payment provider is connected.</Text>
      </Card>}
      <Card>
        <Text style={styles.sectionTitle}>Recent wallet activity</Text>
        {transactions.slice(0, 8).map((transaction) => <View key={transaction.id} style={styles.transaction}><Text style={styles.transactionName}>{titleCase(transaction.type)}</Text><Text style={[styles.transactionAmount, { color: Number(transaction.amount) < 0 ? colors.danger : colors.success }]}>{Number(transaction.amount) < 0 ? '−' : '+'}{formatMoney(Math.abs(Number(transaction.amount)))}</Text></View>)}
        {!transactions.length && <Text style={styles.muted}>No wallet transactions yet.</Text>}
      </Card>
      <AppButton title="Sign out" variant="danger" onPress={() => Alert.alert('Sign out?', 'You can sign back in at any time.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut }])} />
    </Screen>
  );
}

function ModeButton({ title, active, disabled, onPress }: { title: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.mode, active && styles.modeActive]}><Text style={[styles.modeText, active && styles.modeTextActive]}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.green, fontWeight: '900', fontSize: 17 },
  modeRow: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 13, alignItems: 'center' },
  modeActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  modeText: { color: colors.muted, fontWeight: '700' },
  modeTextActive: { color: colors.green, fontWeight: '900' },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  method: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 13, justifyContent: 'center' },
  methodActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  methodText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  methodTextActive: { color: colors.green },
  balanceRow: { flexDirection: 'row', gap: 10 },
  balanceCard: { flex: 1 },
  balance: { color: colors.green, fontWeight: '900', fontSize: 21 },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  transaction: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  transactionName: { color: colors.charcoal, flex: 1 },
  transactionAmount: { fontWeight: '900' },
});
