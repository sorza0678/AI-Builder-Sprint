import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/src/components/pretendard-text';
import {
  AnalysisHistoryRow,
  type AnalysisHistoryItem,
} from '@/src/components/analysis-history-row';
import { getRecentAnalyses } from '@/src/repositories/recent-analysis-repository';
import type { RecentAnalysisSnapshot } from '@/src/storage/storage-types';

interface AnalysisHistorySection {
  title: string;
  data: AnalysisHistoryItem[];
}

const assets = {
  arrow: require('@/assets/images/recent-analyses/arrow-left.svg'),
  search: require('@/assets/images/recent-analyses/search.svg'),
};

const MOCK_HISTORY_SECTIONS: AnalysisHistorySection[] = [
  {
    title: '8월 1일',
    data: [
      {
        id: 'mock-history-1',
        analysisId: 'mock-analysis-1',
        location: '경기 양주시 회천동',
        timeLabel: '46분 전',
        title: '맥북프로 14 M2 pro 16기가 512기가',
        price: '1,850,000원',
        thumbnail: 'macbook',
      },
      {
        id: 'mock-history-2',
        analysisId: 'mock-analysis-2',
        location: '경기 양주시 회천동',
        timeLabel: '1시간 전',
        title: 'BBS RS 18인치',
        price: '600,000원',
        thumbnail: 'placeholder',
      },
    ],
  },
  {
    title: '7월 31일',
    data: [
      {
        id: 'mock-history-3',
        analysisId: 'mock-analysis-3',
        location: '경기 의정부시 민락동',
        timeLabel: '1일 전',
        title: '사진 없이 등록된 아주 긴 상품명을 확인하기 위한 중고 상품',
        price: '10,000원',
        thumbnail: 'placeholder',
      },
    ],
  },
];

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

function getLocation(serverItemId: number): string {
  if (serverItemId === 3) {
    return '경기 의정부시 민락동';
  }

  return '경기 양주시 회천동';
}

function getAnalysisId(serverItemId: number): string {
  return `mock-analysis-${serverItemId}`;
}

function groupRecentAnalyses(items: RecentAnalysisSnapshot[]): AnalysisHistorySection[] {
  const sections = new Map<string, AnalysisHistoryItem[]>();

  items.forEach((item) => {
    const dateLabel = formatDateLabel(item.viewedAt);
    const sectionItems = sections.get(dateLabel) ?? [];
    sectionItems.push({
      id: item.localId,
      analysisId: getAnalysisId(item.serverItemId),
      location: getLocation(item.serverItemId),
      timeLabel: formatTimeLabel(item.viewedAt),
      title: item.title,
      price: `${item.price.toLocaleString('ko-KR')}원`,
      thumbnail: item.serverItemId === 1 ? 'macbook' : 'placeholder',
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

function mergeHistorySections(
  primarySections: AnalysisHistorySection[],
  sampleSections: AnalysisHistorySection[],
): AnalysisHistorySection[] {
  const merged = new Map<string, AnalysisHistoryItem[]>();

  [...primarySections, ...sampleSections].forEach((section) => {
    merged.set(section.title, [...(merged.get(section.title) ?? []), ...section.data]);
  });

  return Array.from(merged.entries()).map(([title, data]) => ({ title, data }));
}

export default function RecentAnalysesScreen() {
  const [items, setItems] = useState<RecentAnalysisSnapshot[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    getRecentAnalyses().then(setItems);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    const source = mergeHistorySections(groupRecentAnalyses(items), MOCK_HISTORY_SECTIONS);
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
        <Text style={styles.headerTitle}>분석 기록</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <TextInput
            accessibilityLabel="분석 기록 검색"
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
        renderItem={({ item }) => <AnalysisHistoryRow item={item} />}
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
