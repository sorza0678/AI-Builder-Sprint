import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/src/components/pretendard-text';
import {
  AnalysisHistoryRow,
  type AnalysisHistoryItem,
} from '@/src/components/analysis-history-row';
import { getHistory } from '@/src/services/history-service';
import type { HistoryItem } from '@/src/services/api-types';

interface AnalysisHistorySection {
  title: string;
  data: AnalysisHistoryItem[];
}

const assets = {
  arrow: require('@/assets/images/recent-analyses/arrow-left.svg'),
  search: require('@/assets/images/recent-analyses/search.svg'),
};

function formatDateLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '최근';
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatTimeLabel(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return '방금 전';
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));

  if (diffMinutes < 1) {
    return '방금 전';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  if (diffMinutes < 1440) {
    return `${Math.floor(diffMinutes / 60)}시간 전`;
  }

  return `${Math.floor(diffMinutes / 1440)}일 전`;
}

function groupRecentAnalyses(items: HistoryItem[]): AnalysisHistorySection[] {
  const sections = new Map<string, AnalysisHistoryItem[]>();

  items.forEach((item) => {
    const dateLabel = formatDateLabel(item.created_at);
    const sectionItems = sections.get(dateLabel) ?? [];
    sectionItems.push({
      id: String(item.item_id),
      analysisId: String(item.item_id),
      location: '지역 표시 미지원',
      timeLabel: formatTimeLabel(item.created_at),
      title: item.title,
      price: `${item.price.toLocaleString('ko-KR')}원`,
      thumbnail: 'placeholder',
    });
    sections.set(dateLabel, sectionItems);
  });

  return Array.from(sections.entries()).map(([title, data]) => ({
    title,
    data,
  }));
}

function filterSections(
  sections: AnalysisHistorySection[],
  query: string,
): AnalysisHistorySection[] {
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) {
    return sections;
  }

  return sections
    .map((section) => ({
      ...section,
      data: section.data.filter((item) =>
        `${item.location} ${item.title} ${item.price}`.toLowerCase().includes(trimmedQuery),
      ),
    }))
    .filter((section) => section.data.length > 0);
}

export default function RecentAnalysesScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const tradeSelectionMode = mode === 'trade';
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    getHistory(1, 50).then(({ items: historyItems }) => setItems(historyItems));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    const source = groupRecentAnalyses(items);
    return filterSections(source, query);
  }, [items, query]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <View style={styles.arrowBox}>
            <Image contentFit="contain" source={assets.arrow} style={styles.arrowIcon} />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>{tradeSelectionMode ? '거래 준비 상품 선택' : '분석 기록'}</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <TextInput
            accessibilityLabel={tradeSelectionMode ? '거래 준비 상품 검색' : '분석 기록 검색'}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="검색"
            placeholderTextColor="#BEC5CA"
            style={styles.searchInput}
            value={query}
          />
          <View style={styles.searchIconBox}>
            <Image contentFit="contain" source={assets.search} style={styles.searchIcon} />
          </View>
        </View>
      </View>

      <SectionList
        contentContainerStyle={styles.content}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>{query ? '검색 결과가 없습니다.' : '최근 본 분석이 없습니다.'}</Text>}
        renderItem={({ item }) => <AnalysisHistoryRow destination={tradeSelectionMode ? 'trade' : 'analysis'} item={item} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>{section.title}</Text>
          </View>
        )}
        sections={sections}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        style={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    width: '100%',
  },
  headerButton: {
    alignItems: 'flex-start',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  arrowBox: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  arrowIcon: {
    height: 16,
    width: 16,
  },
  headerTitle: {
    color: '#111727',
    fontFamily: 'Pretendard-Medium',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
    lineHeight: 24.3,
    textAlign: 'center',
  },
  searchArea: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    width: '100%',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#F4F6FA',
    borderRadius: 35,
    flexDirection: 'row',
    height: 46,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  searchInput: {
    color: '#111727',
    flex: 1,
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    letterSpacing: -0.3,
    includeFontPadding: false,
    lineHeight: 20,
    margin: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  searchIconBox: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    marginLeft: 12,
    width: 18,
  },
  searchIcon: {
    height: 15,
    width: 15,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  list: {
    width: '100%',
  },
  dateHeader: {
    justifyContent: 'center',
    paddingVertical: 16,
  },
  dateText: {
    color: '#111727',
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 16,
  },
  emptyText: {
    color: '#838C97',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.3,
    lineHeight: 20,
    paddingTop: 24,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
});
