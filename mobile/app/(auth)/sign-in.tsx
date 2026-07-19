import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { AppButton, Card, Field, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import { friendlyError, supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setError('');
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) return setError(friendlyError(result.error));
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen style={styles.screen}>
        <View style={styles.brand}>
          <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
          <Text style={styles.name}>RunWise</Text>
          <Text style={styles.tagline}>Your Cart. Our Run.</Text>
        </View>
        <Card style={styles.form}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.copy}>Sign in to request a run or manage your journey.</Text>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <AppButton title="Sign in" onPress={signIn} loading={busy} />
          <Text style={styles.switch}>New to RunWise? <Link href="/(auth)/sign-up" style={styles.link}>Create an account</Link></Text>
        </Card>
        <Text style={styles.region}>Botswana • South Africa • Zimbabwe • Zambia</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 10 },
  logo: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logoText: { color: colors.gold, fontSize: 34, fontWeight: '900' },
  name: { color: colors.green, fontSize: 31, fontWeight: '900' },
  tagline: { color: colors.gold, fontSize: 13, fontWeight: '800', marginTop: 2 },
  form: { gap: 14 },
  heading: { color: colors.green, fontWeight: '900', fontSize: 22 },
  copy: { color: colors.muted, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  switch: { color: colors.muted, textAlign: 'center', marginTop: 2 },
  link: { color: colors.green, fontWeight: '800' },
  region: { color: colors.muted, textAlign: 'center', fontSize: 11, marginTop: 4 },
});
