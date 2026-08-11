import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, Field, LoadingState, Pill, Screen } from '@/components/ui';
import {
  PRIVATE_VEHICLE_MODES,
  REQUEST_LABELS,
  REQUEST_TYPES,
  TRANSIT_MODES,
  TRANSPORT_MODES,
} from '@/lib/constants';
import { getVerification, getVehicles, newId, recordAcceptance } from '@/lib/api';
import { Vehicle } from '@/lib/types';
import { colors, radius } from '@/lib/theme';
import { friendlyError, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function NewTripScreen() {
  const { profile } = useAuth();
  const [verification, setVerification] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [transportMode, setTransportMode] = useState('private_car');
  const [vehicleId, setVehicleId] = useState('');
  const [company, setCompany] = useState('');
  const [plate, setPlate] = useState('');
  const [airline, setAirline] = useState('');
  const [flight, setFlight] = useState('');
  const [details, setDetails] = useState('');
  const [fromCountry, setFromCountry] = useState('Botswana');
  const [fromCity, setFromCity] = useState('');
  const [toCountry, setToCountry] = useState('Botswana');
  const [toCity, setToCity] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [capacityKg, setCapacityKg] = useState('40');
  const [spaces, setSpaces] = useState('6');
  const [stops, setStops] = useState('');
  const [services, setServices] = useState<string[]>(['parcel']);
  const [declared, setDeclared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const needsVehicle = PRIVATE_VEHICLE_MODES.includes(transportMode);
  const needsTransitInfo = TRANSIT_MODES.includes(transportMode);
  const needsAirInfo = transportMode === 'air_travel';
  const needsDetails = transportMode === 'other';

  useEffect(() => {
    if (!profile) return;
    Promise.all([getVerification(profile.id), getVehicles(profile.id)]).then(([v, list]) => {
      const approved = list.filter((item) => item.approved);
      setVerification(v); setVehicles(approved); setVehicleId(approved[0]?.id || '');
    }).catch((err) => Alert.alert('Could not load runner setup', friendlyError(err))).finally(() => setLoading(false));
  }, [profile]);

  if (loading) return <LoadingState />;
  if (verification?.status !== 'approved') return <Screen><Card style={styles.gate}><Text style={styles.gateIcon}>🪪</Text><Text style={styles.gateTitle}>Verification required</Text><Text style={styles.muted}>An administrator must approve your identity before you can announce a trip.</Text><AppButton title="Open verification" onPress={() => router.replace('/verification')} /></Card></Screen>;

  const toggleService = (service: string) => setServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service]);
  const declarationText = needsVehicle
    ? 'I am legally permitted to drive and use this vehicle. I will follow road, insurance, border and customs laws, and reject dangerous or unlawful goods.'
    : 'I will comply with applicable transport, insurance, border and customs laws, and reject dangerous or unlawful goods.';

  const submit = async () => {
    if (!profile) return;
    if (!fromCountry.trim() || !fromCity.trim() || !toCountry.trim() || !toCity.trim() || !date || !time) return Alert.alert('Missing information', 'Complete the route, date and time.');
    if (needsVehicle && !vehicleId) return Alert.alert('Vehicle required', 'Select the approved vehicle you will use, or add one in My Vehicles first.');
    if (needsTransitInfo && !company.trim()) return Alert.alert('Missing information', 'Enter the transport / bus company name.');
    if (needsAirInfo && !airline.trim()) return Alert.alert('Missing information', 'Enter the airline.');
    if (needsDetails && !details.trim()) return Alert.alert('Missing information', 'Describe your transport.');
    if (!services.length) return Alert.alert('Select a service', 'Choose at least one type of request you can carry.');
    if (!declared) return Alert.alert('Declaration required', 'Confirm the runner safety and legal declaration.');
    setBusy(true);
    const id = newId();
    const isCrossBorder = fromCountry.trim().toLowerCase() !== toCountry.trim().toLowerCase();
    try {
      const payload: Record<string, unknown> = {
        id, runner_id: profile.id, transport_mode: transportMode,
        vehicle_id: needsVehicle ? vehicleId : null,
        transport_company: needsTransitInfo ? company.trim() : null,
        licence_plate: needsTransitInfo ? (plate.trim() || null) : null,
        transport_id_complete: needsTransitInfo ? !!plate.trim() : null,
        airline: needsAirInfo ? airline.trim() : null,
        flight_number: needsAirInfo ? (flight.trim() || null) : null,
        transport_details: needsDetails ? details.trim() : null,
        from_country: fromCountry.trim(), from_city: fromCity.trim(),
        to_country: toCountry.trim(), to_city: toCity.trim(),
        depart_date: date, depart_time: time,
        capacity_kg: Number(capacityKg), capacity_spaces: Number(spaces), spaces_remaining: Number(spaces),
        stops: stops.split(',').map((item) => item.trim()).filter(Boolean), services,
        potential_earnings: Math.round(Number(spaces) * 350), status: 'upcoming',
      };
      const { error } = await supabase.from('trips').insert(payload);
      if (error) throw error;
      await recordAcceptance(profile.id, profile.active_role, 'trip_declarations', 'trip_creation', id);
      if (isCrossBorder) await recordAcceptance(profile.id, profile.active_role, 'cross_border_declarations', 'cross_border_trip', id);
      Alert.alert('Trip published', 'RunWise will now find requests along your route.', [{ text: 'Done', onPress: () => router.replace('/(tabs)/activity') }]);
    } catch (err) { Alert.alert('Could not publish trip', friendlyError(err)); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Text style={styles.heading}>Announce your journey</Text>
      <Text style={styles.muted}>How will you travel? Any mode works — public or private.</Text>
      <View style={styles.modes}>{TRANSPORT_MODES.map((mode) => (
        <Pressable key={mode.value} onPress={() => setTransportMode(mode.value)} style={[styles.mode, transportMode === mode.value && styles.modeSelected]}>
          <Text style={styles.modeIcon}>{mode.icon}</Text>
          <Text style={[styles.modeText, transportMode === mode.value && styles.modeTextSelected]}>{mode.label}</Text>
        </Pressable>
      ))}</View>

      {needsVehicle && (
        <View style={styles.vehicleSection}>
          <Text style={styles.label}>Your approved vehicle</Text>
          {vehicles.length ? vehicles.map((vehicle) => (
            <Pressable key={vehicle.id} onPress={() => setVehicleId(vehicle.id)} style={[styles.vehicle, vehicleId === vehicle.id && styles.selected]}>
              <Text style={styles.vehicleName}>{vehicle.make_model}</Text>
              <Text style={styles.muted}>{vehicle.plate_number || 'No plate'}</Text>
              {vehicleId === vehicle.id && <Pill text="Selected" tone="success" />}
            </Pressable>
          )) : (
            <Card style={styles.noVehicleCard}>
              <Text style={styles.noVehicleTitle}>No approved vehicle on file</Text>
              <Text style={styles.muted}>Car, truck and bike trips need an approved vehicle. Add one in My Vehicles if you plan to drive.</Text>
              <AppButton title="Open My Vehicles" variant="secondary" onPress={() => router.replace('/vehicles')} />
            </Card>
          )}
        </View>
      )}

      {needsTransitInfo && (
        <Card>
          <Field label="Transport / bus company" value={company} onChangeText={setCompany} placeholder="e.g. Greyhound, Intercape" />
          <Field label="Vehicle registration / licence plate" value={plate} onChangeText={setPlate} placeholder="e.g. B 123 ABC" hint="If known — you can add it before pickup." />
        </Card>
      )}

      {needsAirInfo && (
        <Card>
          <Field label="Airline" value={airline} onChangeText={setAirline} placeholder="e.g. Air Botswana, Airlink" />
          <Field label="Flight number" value={flight} onChangeText={setFlight} placeholder="e.g. BP 201" />
        </Card>
      )}

      {needsDetails && (
        <Card>
          <Field label="Describe your transport" value={details} onChangeText={setDetails} placeholder="e.g. Walking, water taxi, shared minibus" />
        </Card>
      )}

      <Card>
        <Field label="From country" value={fromCountry} onChangeText={setFromCountry} />
        <Field label="From city" value={fromCity} onChangeText={setFromCity} placeholder="Gaborone" />
        <Field label="To country" value={toCountry} onChangeText={setToCountry} />
        <Field label="To city" value={toCity} onChangeText={setToCity} placeholder="Johannesburg" />
        <Field label="Departure date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" hint="Example: 2026-08-02" />
        <Field label="Departure time" value={time} onChangeText={setTime} placeholder="HH:MM" hint="24-hour format, for example 07:30" />
        <Field label="Capacity (kg)" value={capacityKg} onChangeText={setCapacityKg} keyboardType="decimal-pad" />
        <Field label="Available spaces" value={spaces} onChangeText={setSpaces} keyboardType="number-pad" />
        <Field label="Intermediate stops" value={stops} onChangeText={setStops} placeholder="Pretoria, Polokwane, Tlokweng Border" hint="Separate stops with commas." />
      </Card>
      <Text style={styles.label}>Services offered</Text>
      <View style={styles.services}>{REQUEST_TYPES.map((service) => <Pressable key={service} onPress={() => toggleService(service)} style={[styles.service, services.includes(service) && styles.selected]}><Text style={[styles.serviceText, services.includes(service) && styles.serviceTextSelected]}>{REQUEST_LABELS[service]}</Text></Pressable>)}</View>
      <Pressable onPress={() => setDeclared(!declared)} style={styles.declaration}><View style={[styles.checkbox, declared && styles.checkboxActive]}><Text style={styles.check}>{declared ? '✓' : ''}</Text></View><Text style={styles.declarationText}>{declarationText}</Text></Pressable>
      <AppButton title="Publish trip" onPress={submit} loading={busy} disabled={!!profile?.restricted} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.green, fontSize: 24, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.white, paddingVertical: 9, paddingHorizontal: 13 },
  modeSelected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  modeIcon: { fontSize: 16 },
  modeText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  modeTextSelected: { color: colors.green, fontWeight: '900' },
  vehicleSection: { gap: 8 },
  label: { color: colors.green, fontWeight: '900', fontSize: 17, marginTop: 6 },
  vehicles: { gap: 8 },
  vehicle: { minHeight: 64, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 14, gap: 5 },
  vehicleName: { color: colors.green, fontWeight: '900', fontSize: 17 },
  noVehicleCard: { gap: 8, marginTop: 8 },
  noVehicleTitle: { color: colors.green, fontWeight: '900', fontSize: 16 },
  selected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  service: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.white, paddingVertical: 11, paddingHorizontal: 14, justifyContent: 'center' },
  serviceText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
  serviceTextSelected: { color: colors.green, fontWeight: '900' },
  declaration: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.goldSoft, borderRadius: radius.sm, padding: 14 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.green, borderColor: colors.green },
  check: { color: colors.white, fontWeight: '900' },
  declarationText: { flex: 1, color: colors.charcoal, fontSize: 16, lineHeight: 23 },
  gate: { alignItems: 'center', marginTop: 50, paddingVertical: 30 },
  gateIcon: { fontSize: 46 },
  gateTitle: { color: colors.green, fontSize: 21, fontWeight: '900' },
});
