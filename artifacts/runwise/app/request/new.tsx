import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, Field, Screen } from '@/components/ui';
import { REQUEST_ICONS, REQUEST_LABELS, REQUEST_TYPES } from '@/lib/constants';
import { newId, recordAcceptance } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { friendlyError, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function NewRequestScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const { profile } = useAuth();
  const [type, setType] = useState<string>('parcel');
  const [fromCity, setFromCity] = useState(params.from || '');
  const [toCity, setToCity] = useState(params.to || '');
  const [value, setValue] = useState('');
  const [fromLandmark, setFromLandmark] = useState('');
  const [toLandmark, setToLandmark] = useState('');
  const [details, setDetails] = useState('');
  const [directions, setDirections] = useState('');
  const [crossBorder, setCrossBorder] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!profile) return;
    if (!fromCity.trim() || !toCity.trim()) return Alert.alert('Route required', 'Enter both pickup and delivery cities.');
    if (fromCity.trim().toLowerCase() === toCity.trim().toLowerCase()) return Alert.alert('Check the route', 'Pickup and delivery cities must be different.');
    if (!declared) return Alert.alert('Declaration required', 'Confirm that the request is accurate and contains no prohibited goods.');
    setBusy(true);
    const id = newId();
    try {
      const { error } = await supabase.from('requests').insert({
        id, customer_id: profile.id, type,
        from_city: fromCity.trim(), to_city: toCity.trim(),
        estimated_value: Number(value || 0),
        from_landmark: fromLandmark.trim() || null,
        to_landmark: toLandmark.trim() || null,
        details: details.trim() || null,
        written_directions: directions.trim() || null,
      });
      if (error) throw error;
      await recordAcceptance(profile.id, profile.active_role, 'request_declarations', 'request_creation', id);
      if (crossBorder) await recordAcceptance(profile.id, profile.active_role, 'cross_border_declarations', 'cross_border_request', id);
      Alert.alert('Request posted', 'Runners on matching routes can now send you an offer.', [
        { text: 'Done', onPress: () => router.replace('/(tabs)/activity') },
      ]);
    } catch (err) { Alert.alert('Could not post request', friendlyError(err)); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Text style={styles.intro}>What do you need moved?</Text>
      <View style={styles.types}>
        {REQUEST_TYPES.map((item) => (
          <Pressable key={item} onPress={() => setType(item)} style={[styles.type, type === item && styles.typeActive]}>
            <Text style={styles.typeIcon}>{REQUEST_ICONS[item]}</Text>
            <Text style={[styles.typeText, type === item && styles.typeTextActive]}>{REQUEST_LABELS[item]}</Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <Field label="Pickup city" value={fromCity} onChangeText={setFromCity} placeholder="Gaborone" />
        <Field label="Delivery city" value={toCity} onChangeText={setToCity} placeholder="Francistown" />
        <Field label="Estimated item value (P)" value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="0.00" />
        <Field label="Landmark near pickup (optional)" value={fromLandmark} onChangeText={setFromLandmark} />
        <Field label="Landmark near delivery (optional)" value={toLandmark} onChangeText={setToLandmark} />
        <Field label="Item details" value={details} onChangeText={setDetails} multiline maxLength={600} placeholder="Size, quantity, shop, handling instructions…" hint={`${details.length}/600`} />
        <Field label="Written directions (optional)" value={directions} onChangeText={setDirections} multiline />
      </Card>
      <CheckRow checked={crossBorder} onPress={() => setCrossBorder(!crossBorder)} text="This request crosses an international border." />
      <CheckRow checked={declared} onPress={() => setDeclared(!declared)} text="I confirm this request is accurate, lawful and contains no dangerous or prohibited goods." />
      <AppButton title="Post request" onPress={submit} loading={busy} disabled={!!profile?.restricted} />
    </Screen>
  );
}

function CheckRow({ checked, onPress, text }: { checked: boolean; onPress: () => void; text: string }) {
  return (
    <Pressable onPress={onPress} style={styles.checkRow}>
      <View style={[styles.checkbox, checked && styles.checkboxActive]}><Text style={styles.check}>{checked ? '✓' : ''}</Text></View>
      <Text style={styles.checkText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.green, fontWeight: '900', fontSize: 22 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  type: { width: '31%', minHeight: 100, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 10, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', gap: 6 },
  typeActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  typeIcon: { fontSize: 24 },
  typeText: { color: colors.muted, fontSize: 14, textAlign: 'center', fontWeight: '700' },
  typeTextActive: { color: colors.green },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 13 },
  checkbox: { width: 24, height: 24, borderWidth: 1, borderColor: colors.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.green, borderColor: colors.green },
  check: { color: colors.white, fontWeight: '900' },
  checkText: { flex: 1, color: colors.charcoal, fontSize: 16, lineHeight: 23 },
});
