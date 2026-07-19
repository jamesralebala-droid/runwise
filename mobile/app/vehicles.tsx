import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, EmptyState, Field, LoadingState, Pill, Screen } from '@/components/ui';
import { getVehicles, newId, uploadAsset } from '@/lib/api';
import { Vehicle } from '@/lib/types';
import { colors } from '@/lib/theme';
import { friendlyError, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type Asset = DocumentPicker.DocumentPickerAsset;

export default function VehiclesScreen() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [makeModel, setMakeModel] = useState('');
  const [plate, setPlate] = useState('');
  const [photos, setPhotos] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { if (!profile) return; setLoading(true); try { setVehicles(await getVehicles(profile.id)); } catch (err) { Alert.alert('Could not load vehicles', friendlyError(err)); } finally { setLoading(false); } }, [profile]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const pickPhotos = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: true });
    if (!result.canceled) setPhotos(result.assets);
  };
  const submit = async () => {
    if (!profile || !makeModel.trim() || !plate.trim() || !photos.length) return Alert.alert('Missing information', 'Enter the vehicle details and select at least one photo.');
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const photo of photos) paths.push(await uploadAsset(profile.id, 'vehicles', photo));
      const { error } = await supabase.from('vehicles').insert({ id: newId(), user_id: profile.id, make_model: makeModel.trim(), plate_number: plate.trim().toUpperCase(), photo_urls: paths, approved: false, review_status: 'pending' });
      if (error) throw error;
      setMakeModel(''); setPlate(''); setPhotos([]);
      Alert.alert('Vehicle submitted', 'An administrator will review it before it can be used for trips.');
      load();
    } catch (err) { Alert.alert('Submission failed', friendlyError(err)); }
    finally { setBusy(false); }
  };
  if (loading) return <LoadingState />;
  return (
    <Screen>
      <Text style={styles.title}>Your vehicles</Text>
      {vehicles.length ? vehicles.map((vehicle) => {
        const status = vehicle.review_status || (vehicle.approved ? 'approved' : 'pending');
        return <Card key={vehicle.id}>
          <View style={styles.row}><Text style={styles.vehicle}>{vehicle.make_model}</Text><Pill text={status === 'pending' ? 'pending approval' : status} tone={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'} /></View>
          <Text style={styles.muted}>Plate: {vehicle.plate_number || 'Not provided'} • {vehicle.photo_urls.length} photo(s)</Text>
          {status === 'rejected' && <View style={styles.feedback}><Text style={styles.feedbackTitle}>Why it was rejected</Text><Text style={styles.feedbackText}>{vehicle.rejection_reason || 'Please correct the vehicle details or photos and submit a new vehicle.'}</Text></View>}
        </Card>;
      }) : <EmptyState icon="🚙" title="No vehicles" message="Add the vehicle you will use for RunWise journeys." />}
      <Card>
        <Text style={styles.title}>Add a vehicle</Text>
        <Field label="Make and model" value={makeModel} onChangeText={setMakeModel} placeholder="Toyota Hilux" />
        <Field label="Plate number" value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder="B 123 ABC" />
        <AppButton title={photos.length ? `${photos.length} photo(s) selected` : 'Choose vehicle photos'} variant="secondary" onPress={pickPhotos} />
        <AppButton title="Submit vehicle" onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { color: colors.green, fontWeight: '900', fontSize: 20 }, vehicle: { color: colors.green, fontWeight: '900', fontSize: 18, flex: 1 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, muted: { color: colors.muted, fontSize: 16, lineHeight: 23 }, feedback: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#FDEDE9', borderLeftWidth: 4, borderLeftColor: colors.danger }, feedbackTitle: { color: colors.danger, fontSize: 16, fontWeight: '900' }, feedbackText: { color: colors.charcoal, fontSize: 16, lineHeight: 23, marginTop: 4 } });
