import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, Field, LoadingState, Pill, Screen } from '@/components/ui';
import { getVerification, newId, uploadAsset } from '@/lib/api';
import { colors } from '@/lib/theme';
import { friendlyError, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type Asset = DocumentPicker.DocumentPickerAsset;

export default function VerificationScreen() {
  const { profile } = useAuth();
  const [verification, setVerification] = useState<any>(null);
  const [idDocument, setIdDocument] = useState<Asset | null>(null);
  const [selfie, setSelfie] = useState<Asset | null>(null);
  const [kinName, setKinName] = useState('');
  const [kinPhone, setKinPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { if (!profile) return; setLoading(true); try { setVerification(await getVerification(profile.id)); } catch (err) { Alert.alert('Could not load verification', friendlyError(err)); } finally { setLoading(false); } }, [profile]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pick = async (setter: (asset: Asset) => void) => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: false });
    if (!result.canceled) setter(result.assets[0]);
  };
  const submit = async () => {
    if (!profile || !idDocument || !selfie || !kinName.trim() || !kinPhone.trim()) return Alert.alert('Missing information', 'Add both images and complete the next-of-kin details.');
    setBusy(true);
    try {
      const [idPath, selfiePath] = await Promise.all([uploadAsset(profile.id, 'kyc', idDocument), uploadAsset(profile.id, 'kyc', selfie)]);
      const { error } = await supabase.from('runner_verifications').insert({ id: newId(), user_id: profile.id, id_document_url: idPath, selfie_url: selfiePath, next_of_kin_name: kinName.trim(), next_of_kin_phone: kinPhone.trim(), status: 'pending' });
      if (error) throw error;
      Alert.alert('Submitted', 'Your documents are private and waiting for administrator review.');
      load();
    } catch (err) { Alert.alert('Submission failed', friendlyError(err)); }
    finally { setBusy(false); }
  };
  if (loading) return <LoadingState />;
  const canSubmit = !verification || verification.status === 'rejected';
  return (
    <Screen>
      <Card>
        <View style={styles.row}><Text style={styles.title}>Verification status</Text><Pill text={verification?.status || 'not submitted'} tone={verification?.status === 'approved' ? 'success' : verification?.status === 'rejected' ? 'danger' : 'warning'} /></View>
        <Text style={styles.muted}>{verification?.status === 'approved' ? 'Your identity is approved. You can announce trips once you also have an approved vehicle.' : verification?.status === 'pending' ? 'An administrator is reviewing your private documents.' : 'Submit a valid ID or passport, a clear selfie and next-of-kin details.'}</Text>
      </Card>
      {canSubmit && <Card>
        <Text style={styles.title}>Private identity documents</Text>
        <AppButton title={idDocument ? `ID: ${idDocument.name}` : 'Choose ID or passport photo'} variant="secondary" onPress={() => pick(setIdDocument)} />
        <AppButton title={selfie ? `Selfie: ${selfie.name}` : 'Choose selfie photo'} variant="secondary" onPress={() => pick(setSelfie)} />
        <Field label="Next of kin name" value={kinName} onChangeText={setKinName} />
        <Field label="Next of kin phone" value={kinPhone} onChangeText={setKinPhone} keyboardType="phone-pad" />
        <Text style={styles.privacy}>🔒 Files are uploaded to the private RunWise storage bucket. Other users cannot open them.</Text>
        <AppButton title="Submit for review" onPress={submit} loading={busy} />
      </Card>}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, title: { color: colors.green, fontWeight: '900', fontSize: 19 }, muted: { color: colors.muted, fontSize: 16, lineHeight: 24 }, privacy: { color: colors.muted, lineHeight: 21, fontSize: 14 } });
