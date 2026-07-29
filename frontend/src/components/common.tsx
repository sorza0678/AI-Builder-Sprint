import { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text,
  TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/src/constants/theme';
import { Listing } from '@/src/types/marketplace';

export function ScreenContainer({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const content = scroll
    ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={styles.content}>{children}</View>;
  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>;
}

export function AppButton({ title, onPress, disabled = false, variant = 'primary', accessibilityLabel }: {
  title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button, variant !== 'primary' && styles.secondaryButton,
        disabled && styles.disabled, pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.buttonText, variant !== 'primary' && styles.secondaryButtonText]}>{title}</Text>
    </Pressable>
  );
}

export function AppTextInput(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

export function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Card>
      <Text style={styles.cardTitle}>{listing.title}</Text>
      <Text style={styles.muted}>{listing.platform} · {listing.price.toLocaleString()}원</Text>
      <Text style={styles.body}>{listing.defects.join(', ') || '판매자가 밝힌 하자 없음'}</Text>
    </Card>
  );
}

export function LoadingState() {
  return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text>불러오는 중...</Text></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View style={styles.center}><Text style={styles.error}>{message}</Text>{onRetry && <AppButton title="다시 시도" onPress={onRetry} />}</View>;
}

export function EmptyState({ message }: { message: string }) {
  return <Text style={styles.muted}>{message}</Text>;
}

export const commonStyles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: spacing.sm },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: spacing.lg },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', gap: spacing.sm },
  gap: { gap: spacing.md },
  badge: { alignSelf: 'flex-start', backgroundColor: '#EAF2FF', borderRadius: 999, color: colors.primary, paddingHorizontal: 10, paddingVertical: 5 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.md, gap: spacing.md },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md },
  secondaryButton: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: colors.text },
  disabled: { backgroundColor: colors.disabled, opacity: 0.7 },
  pressed: { opacity: 0.75 },
  input: { minHeight: 48, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, gap: spacing.xs, padding: spacing.md },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  muted: { color: colors.muted, lineHeight: 20 },
  body: { color: colors.text, lineHeight: 21 },
  center: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  error: { color: colors.danger, textAlign: 'center' },
});
