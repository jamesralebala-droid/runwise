import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, Field, Screen } from '@/components/ui';
import { colors, radius } from '@/lib/theme';
import { friendlyError, supabase } from '@/lib/supabase';
import { UserRole } from '@/lib/types';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signUp = async () => {
    setError('');
    if (!name.trim() || !email.trim() || password.length < 6) return setError('Complete all required fields. Password must have at least 6 characters.');
    if (!accepted) return setError('Accept the RunWise Terms and Privacy Policy to continue.');
    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), role, phone: phone.trim() || null } },
    });
    if (!signUpError && data.user && phone.trim()) {
      await supabase.from('profiles').update({ phone: phone.trim() }).eq('id', data.user.id);
    }
    setBusy(false);
    if (signUpError) return setError(friendlyError(signUpError));
    router.replace(data.session ? '/(tabs)' : '/(auth)/sign-in');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.headingWrap}>
          <Text style={styles.heading}>Create your RunWise account</Text>
          <Text style={styles.copy}>One account can switch between customer and runner mode.</Text>
        </View>
        <Card style={{ gap: 14 }}>
          <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
          <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint="Used only when an order handover is close enough." />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry hint="At least 6 characters" />
          <Text style={styles.label}>Start as</Text>
          <View style={styles.roles}>
            {(['customer', 'runner'] as UserRole[]).map((item) => (
              <Pressable key={item} onPress={() => setRole(item)} style={[styles.role, role === item && styles.roleActive]}>
                <Text style={styles.roleIcon}>{item === 'customer' ? '🛍️' : '🚙'}</Text>
                <Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item === 'customer' ? 'Customer' : 'Runner'}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setAccepted(!accepted)} style={styles.checkRow}>
            <View style={[styles.checkbox, accepted && styles.checkboxActive]}><Text style={styles.checkmark}>{accepted ? '✓' : ''}</Text></View>
            <Text style={styles.checkCopy}>I accept the RunWise Terms, Privacy Policy and community rules.</Text>
          </Pressable>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <AppButton title="Create account" onPress={signUp} loading={busy} />
          <Text style={styles.switch}>Already registered? <Link href="/(auth)/sign-in" style={styles.link}>Sign in</Link></Text>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headingWrap: { marginVertical: 10 },
  heading: { color: colors.green, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 16, marginTop: 6, lineHeight: 24 },
  label: { color: colors.charcoal, fontWeight: '700', fontSize: 15 },
  roles: { flexDirection: 'row', gap: 10 },
  role: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 14, alignItems: 'center', gap: 5 },
  roleActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  roleIcon: { fontSize: 24 },
  roleText: { color: colors.muted, fontWeight: '700' },
  roleTextActive: { color: colors.green },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.green, borderColor: colors.green },
  checkmark: { color: colors.white, fontWeight: '900' },
  checkCopy: { flex: 1, color: colors.muted, fontSize: 15, lineHeight: 22 },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  switch: { color: colors.muted, textAlign: 'center' },
  link: { color: colors.green, fontWeight: '800' },
});
