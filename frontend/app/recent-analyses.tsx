import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/src/components/pretendard-text';
import { getRecentAnalyses } from '@/src/repositories/recent-analysis-repository';
import type { RecentAnalysisSnapshot } from '@/src/storage/storage-types';

export default function RecentAnalysesScreen() {
  const [items, setItems] = useState<RecentAnalysisSnapshot[]>([]);

  const load = useCallback(() => {
    getRecentAnalyses().then(setItems);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="최근 본 분석" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>디자인 적용 전 로컬 저장 확인용 화면입니다.</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>최근 본 분석이 없습니다.</Text>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.localId}
              onPress={() => router.push(`/analysis/mock-analysis-${item.serverItemId}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>serverItemId: {item.serverItemId}</Text>
              <Text style={styles.body}>가격: {item.price.toLocaleString('ko-KR')}원</Text>
              <Text style={styles.body}>URL: {item.sourceUrl}</Text>
              <Text style={styles.muted}>viewedAt: {item.viewedAt}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>뒤로</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
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
  note: { color: '#777777', fontSize: 13, lineHeight: 19 },
  empty: { color: '#999999', fontSize: 15, marginTop: 24 },
  card: { padding: 14, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, gap: 6 },
  title: { color: '#111111', fontSize: 16, fontWeight: '700' },
  body: { color: '#333333', fontSize: 14, lineHeight: 20 },
  muted: { color: '#777777', fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.65 },
});
