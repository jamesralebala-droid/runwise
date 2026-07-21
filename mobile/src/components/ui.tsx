import { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '@/lib/theme';

export function Screen({ children, scroll = true, style }: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle> }>) {
  const content = <View style={[styles.screenContent, style]}>{children}</View>;
  return (
    // Insetting both top and bottom (not just top) keeps content clear of the
    // status bar/notch AND the home indicator / Android gesture bar. The old
    // top-only version relied on a fixed 44px guess for bottom padding, which
    // isn't enough on some real devices and left content sitting under the
    // home indicator or gesture bar — easy to miss in a simulator/preview
    // that doesn't render those the same way a physical phone does.
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Header({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        inactive && styles.buttonDisabled,
        pressed && !inactive && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.white : colors.green} /> : (
        <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#97A19C"
        style={[styles.input, props.multiline && styles.textarea, !!error && styles.inputError]}
        {...props}
      />
      {!!hint && !error && <Text style={styles.hint}>{hint}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'gold' }) {
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ icon = '📭', title, message, action }: { icon?: string; title: string; message: string; action?: ReactNode }) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {action}
    </Card>
  );
}

export function LoadingState() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={colors.green} /><Text style={styles.subtitle}>Loading…</Text></View>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <Card style={styles.errorCard}><Text style={styles.errorTitle}>Could not load this</Text><Text style={styles.subtitle}>{message}</Text>{retry && <AppButton title="Try again" onPress={retry} variant="secondary" />}</Card>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  scroll: { flexGrow: 1 },
  screenContent: { flex: 1, padding: 18, paddingBottom: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.gold, fontWeight: '800', fontSize: 13, letterSpacing: 1.1, marginBottom: 4 },
  title: { color: colors.green, fontWeight: '900', fontSize: 28, letterSpacing: -0.6 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 5 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10, ...shadow },
  button: { minHeight: 54, borderRadius: radius.sm, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  button_primary: { backgroundColor: colors.green, borderColor: colors.green },
  button_secondary: { backgroundColor: colors.white, borderColor: colors.green },
  button_danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  button_ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
  buttonText: { fontSize: 17, fontWeight: '800' },
  buttonText_primary: { color: colors.white },
  buttonText_secondary: { color: colors.green },
  buttonText_danger: { color: colors.danger },
  buttonText_ghost: { color: colors.green },
  field: { gap: 6 },
  label: { color: colors.charcoal, fontWeight: '700', fontSize: 15 },
  input: { minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.white, paddingHorizontal: 14, color: colors.charcoal, fontSize: 17 },
  textarea: { minHeight: 104, paddingTop: 13, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 11 },
  pill_neutral: { backgroundColor: '#EEF0EF' },
  pill_success: { backgroundColor: colors.greenSoft },
  pill_warning: { backgroundColor: colors.goldSoft },
  pill_danger: { backgroundColor: colors.dangerSoft },
  pill_gold: { backgroundColor: colors.gold },
  pillText: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  pillText_neutral: { color: colors.charcoal },
  pillText_success: { color: colors.success },
  pillText_warning: { color: colors.warning },
  pillText_danger: { color: colors.danger },
  pillText_gold: { color: colors.green },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { color: colors.green, fontWeight: '900', fontSize: 18 },
  emptyMessage: { color: colors.muted, textAlign: 'center', fontSize: 16, lineHeight: 24, marginBottom: 4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  errorCard: { borderColor: '#E7C4BD' },
  errorTitle: { color: colors.danger, fontWeight: '900', fontSize: 18 },
});
