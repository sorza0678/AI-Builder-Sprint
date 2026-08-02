import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/src/components/pretendard-text';

const DEBUG_ROUTES = [
  { label: '찜 목록', href: '/saved-listings' },
  { label: '비교 기록', href: '/comparison-history' },
  { label: '거래 내역', href: '/trade-records' },
  { label: '최근 본 분석', href: '/recent-analyses' },
] as const;

export default function GuestStorageDebugScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>뒤로</Text>
        </Pressable>
        <Text style={styles.headerTitle}>로컬 저장 확인</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.note}>
          디자인 적용 전 테스트용 화면입니다. 각 목록은 AsyncStorage에 저장된 비회원 데이터를 그대로 보여줍니다.
        </Text>
        {DEBUG_ROUTES.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  backButton: { width: 52, height: 40, justifyContent: 'center' },
  backText: { color: '#555555', fontSize: 14 },
  headerTitle: { flex: 1, color: '#111111', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 52 },
  content: { padding: 16, gap: 12 },
  note: { color: '#777777', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  button: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, justifyContent: 'center' },
  buttonText: { color: '#111111', fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.65 },
});
