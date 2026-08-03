import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Href, router } from 'expo-router';
import { Image } from 'expo-image';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/src/components/pretendard-text';
import { ErrorState, LoadingState } from '@/src/components/common';
import { getTransactions } from '@/src/services/trade-service';
import type { ApiTransactionStage, TransactionItem } from '@/src/services/api-types';

type TradeStatus = ApiTransactionStage;

type TradeFilter = 'ALL' | TradeStatus;

interface TradeHistoryItem {
  id: string;
  analysisHref: Href;
  title: string;
  price: string;
  status: TradeStatus;
  badge?: string;
}

const assets = {
  arrow: require('@/assets/images/recent-analyses/arrow-left.svg'),
  search: require('@/assets/images/recent-analyses/search.svg'),
};

const FILTERS: { label: string; value: TradeFilter }[] = [
  { label: '전체', value: 'ALL' },
  { label: '문의 전', value: 'BEFORE_CONTACT' },
  { label: '문의 중', value: 'CONTACTING' },
  { label: '거래 약속', value: 'SCHEDULED' },
  { label: '거래 완료', value: 'COMPLETED' },
];

function getStatusLabel(status: TradeStatus): string {
  switch (status) {
    case 'BEFORE_CONTACT':
      return '문의 전';
    case 'CONTACTING':
      return '문의 중';
    case 'SCHEDULED':
      return '거래 약속';
    case 'COMPLETED':
      return '거래 완료';
  }
}

function isActiveStatus(status: TradeStatus): boolean {
  return status === 'CONTACTING' || status === 'SCHEDULED';
}

function mapTradeRecord(record: TransactionItem): TradeHistoryItem {
  return {
    id: String(record.item_id),
    analysisHref: `/trade/${record.item_id}` as Href,
    title: record.title,
    price: `${record.price.toLocaleString('ko-KR')}원`,
    status: record.stage,
    badge: record.decision === 'CONSIDERING' ? '구매고려' : record.decision === 'HOLD' ? '보류' : record.decision === 'EXCLUDED' ? '비교제외' : undefined,
  };
}

function filterTradeItems(
  items: TradeHistoryItem[],
  query: string,
  selectedFilter: TradeFilter,
): TradeHistoryItem[] {
  const trimmedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    const matchesFilter = selectedFilter === 'ALL' || item.status === selectedFilter;
    const matchesQuery =
      !trimmedQuery ||
      `${item.title} ${item.price} ${getStatusLabel(item.status)} ${item.badge ?? ''}`
        .toLowerCase()
        .includes(trimmedQuery);

    return matchesFilter && matchesQuery;
  });
}

export default function TradeRecordsScreen() {
  const [records, setRecords] = useState<TransactionItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<TradeFilter>('ALL');
  const [isListScrolled, setIsListScrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    void getTransactions()
      .then(({ items }) => {
        if (active) setRecords(items);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : '거래 내역을 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  const items = useMemo(() => {
    const storedItems = records.map(mapTradeRecord);
    return filterTradeItems(storedItems, query, selectedFilter);
  }, [query, records, selectedFilter]);

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
        <Text style={styles.headerTitle}>거래 내역</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <TextInput
            accessibilityLabel="거래 내역 검색"
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

      <View style={[styles.filterArea, isListScrolled && styles.filterAreaScrolled]}>
        <FlatList
          contentContainerStyle={styles.filterContent}
          data={FILTERS}
          horizontal
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <FilterChip
              active={selectedFilter === item.value}
              label={item.label}
              onPress={() => setSelectedFilter(item.value)}
            />
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading
            ? <LoadingState />
            : loadError
              ? <ErrorState message={loadError} onRetry={load} />
              : <Text style={styles.emptyText}>
                  {query ? '검색 결과가 없습니다.' : '저장된 거래 내역이 없습니다.'}
                </Text>
        }
        onScroll={(event) => {
          const nextIsScrolled = event.nativeEvent.contentOffset.y > 0;
          setIsListScrolled((current) =>
            current === nextIsScrolled ? current : nextIsScrolled,
          );
        }}
        scrollEventThrottle={16}
        renderItem={({ item }) => <TradeHistoryRow item={item} />}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active ? styles.filterChipActive : styles.filterChipInactive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.filterText, active ? styles.filterTextActive : styles.filterTextInactive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TradeHistoryRow({ item }: { item: TradeHistoryItem }) {
  const active = isActiveStatus(item.status);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title} 거래 상세 보기`}
      onPress={() => router.push(item.analysisHref)}
      style={({ pressed }) => [styles.itemContainer, pressed && styles.pressed]}>
      <View style={styles.itemContent}>
        <View style={styles.itemTextGroup}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.title}
          </Text>
          <View style={styles.priceRow}>
            <Text numberOfLines={1} style={styles.priceText}>
              {item.price}
            </Text>
            {item.badge ? (
              <View style={styles.badge}>
                <Text numberOfLines={1} style={styles.badgeText}>
                  {item.badge}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextMuted]}>
          {getStatusLabel(item.status)}
        </Text>
      </View>
    </Pressable>
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
    fontSize: 15,
    includeFontPadding: false,
    letterSpacing: -0.3,
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
  filterArea: {
    height: 60,
    justifyContent: 'center',
    paddingVertical: 7,
    width: '100%',
  },
  filterAreaScrolled: {
    borderBottomColor: '#F6F5FA',
    borderBottomWidth: 1,
  },
  filterContent: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: '#8656C2',
    borderColor: '#8656C2',
    borderWidth: 1,
  },
  filterChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EDEDED',
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    letterSpacing: -0.3,
    lineHeight: 14,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  filterTextInactive: {
    color: '#838C97',
    fontWeight: '400',
  },
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  itemContainer: {
    borderBottomColor: '#F6F5FA',
    borderBottomWidth: 1,
    minHeight: 94,
    width: '100%',
  },
  itemContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'space-between',
    minHeight: 94,
    paddingVertical: 24,
  },
  itemTextGroup: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  itemTitle: {
    color: '#111727',
    fontSize: 16,
    fontWeight: '500',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 16,
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  priceText: {
    color: '#838C97',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 14,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#EFF3FF',
    borderRadius: 28,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#8656C2',
    fontSize: 12,
    fontWeight: '500',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 16.2,
  },
  statusText: {
    fontSize: 15,
    includeFontPadding: false,
    letterSpacing: -0.2192,
    lineHeight: 15,
    textAlign: 'right',
  },
  statusTextActive: {
    color: '#8656C2',
    fontWeight: '700',
  },
  statusTextMuted: {
    color: '#838C97',
    fontWeight: '400',
  },
  emptyText: {
    color: '#838C97',
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
