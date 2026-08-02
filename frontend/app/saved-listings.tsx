import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getSavedListings } from '@/src/repositories/saved-listing-repository';
import type { SavedListingSnapshot } from '@/src/storage/storage-types';

type SavedListingThumbnail = 'macbook' | 'placeholder' | { uri: string };

interface SavedListingItem {
  id: string;
  analysisHref: Href;
  location: string;
  title: string;
  price: string;
  timeLabel: string;
  thumbnail: SavedListingThumbnail;
}

const assets = {
  arrow: require('@/assets/images/recent-analyses/arrow-left.svg'),
  macbook: require('@/assets/images/recent-analyses/macbook.png'),
  placeholder: require('@/assets/images/recent-analyses/placeholder-mark.svg'),
  search: require('@/assets/images/recent-analyses/search.svg'),
};

const MOCK_SAVED_LISTINGS: SavedListingItem[] = [
  {
    id: 'mock-saved-1',
    analysisHref: '/analysis/mock-analysis-1',
    location: '경기 양주시 회천동',
    title: '맥북프로 14 M2 pro 16기가 512기가맥북프로 14 M2 pro 16기가',
    price: '1,850,000원',
    timeLabel: '46분 전',
    thumbnail: 'macbook',
  },
  {
    id: 'mock-saved-2',
    analysisHref: '/analysis/mock-analysis-2',
    location: '경기 양주시 회천동',
    title: 'BBS RS 18인치',
    price: '600,000원',
    timeLabel: '46분 전',
    thumbnail: 'placeholder',
  },
  {
    id: 'mock-saved-3',
    analysisHref: '/analysis/mock-analysis-3',
    location: '경기 의정부시 민락동',
    title: 'Enkei RPF1 17인치',
    price: '10,000원',
    timeLabel: '1시간 전',
    thumbnail: 'placeholder',
  },
];

function formatRelativeTime(value: string): string {
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

function getAnalysisHref(serverItemId: number): Href {
  return `/analysis/mock-analysis-${serverItemId}` as Href;
}

function mapSavedListing(item: SavedListingSnapshot): SavedListingItem {
  return {
    id: item.localId,
    analysisHref: getAnalysisHref(item.serverItemId),
    location: getLocation(item.serverItemId),
    title: item.title,
    price: `${item.price.toLocaleString('ko-KR')}원`,
    timeLabel: formatRelativeTime(item.updatedAt),
    thumbnail: item.imageUrl ? { uri: item.imageUrl } : 'placeholder',
  };
}

function filterSavedListings(items: SavedListingItem[], query: string): SavedListingItem[] {
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) {
    return items;
  }

  return items.filter((item) =>
    `${item.location} ${item.title} ${item.price}`.toLowerCase().includes(trimmedQuery),
  );
}

export default function SavedListingsScreen() {
  const [storedListings, setStoredListings] = useState<SavedListingSnapshot[]>([]);
  const [query, setQuery] = useState('');
  const [isListScrolled, setIsListScrolled] = useState(false);

  const load = useCallback(() => {
    getSavedListings().then(setStoredListings);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => {
    const storedItems = storedListings.map(mapSavedListing);
    return filterSavedListings([...storedItems, ...MOCK_SAVED_LISTINGS], query);
  }, [query, storedListings]);

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
        <Text style={styles.headerTitle}>찜한 상품</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={[styles.searchArea, isListScrolled && styles.searchAreaScrolled]}>
        <View style={styles.searchBox}>
          <TextInput
            accessibilityLabel="찜한 상품 검색"
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

      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {query ? '검색 결과가 없습니다.' : '찜한 상품이 없습니다.'}
          </Text>
        }
        onScroll={(event) => {
          const nextIsScrolled = event.nativeEvent.contentOffset.y > 0;
          setIsListScrolled((current) =>
            current === nextIsScrolled ? current : nextIsScrolled,
          );
        }}
        renderItem={({ item }) => <SavedListingRow item={item} />}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </SafeAreaView>
  );
}

function SavedListingRow({ item }: { item: SavedListingItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title} 분석 상세 보기`}
      onPress={() => router.push(item.analysisHref)}
      style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}>
      <ListingThumbnail thumbnail={item.thumbnail} />
      <View style={styles.itemInfo}>
        <Text numberOfLines={1} style={styles.locationText}>
          {item.location}
        </Text>
        <Text numberOfLines={1} style={styles.titleText}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.priceText}>
          {item.price}
        </Text>
        <Text numberOfLines={1} style={styles.timeText}>
          {item.timeLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function ListingThumbnail({ thumbnail }: { thumbnail: SavedListingThumbnail }) {
  if (thumbnail === 'placeholder') {
    return (
      <View style={styles.placeholderThumbnail}>
        <View style={styles.placeholderIconBox}>
          <Image contentFit="contain" source={assets.placeholder} style={styles.placeholderIcon} />
        </View>
      </View>
    );
  }

  const source = thumbnail === 'macbook' ? assets.macbook : thumbnail;

  return <Image contentFit="cover" source={source} style={styles.thumbnail} />;
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
  searchAreaScrolled: {
    borderBottomColor: '#F6F5FA',
    borderBottomWidth: 1,
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
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  itemRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    width: '100%',
  },
  thumbnail: {
    borderRadius: 10,
    height: 81,
    width: 81,
  },
  placeholderThumbnail: {
    alignItems: 'center',
    backgroundColor: '#F4F6FA',
    borderRadius: 10,
    height: 81,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 81,
  },
  placeholderIconBox: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  placeholderIcon: {
    height: 33.455,
    width: 45.29,
  },
  itemInfo: {
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minWidth: 0,
  },
  locationText: {
    color: '#838C97',
    fontSize: 12,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 12,
  },
  titleText: {
    color: '#515760',
    fontSize: 14,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 14,
  },
  priceText: {
    color: '#484B4D',
    fontSize: 15,
    fontWeight: '500',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 15,
  },
  timeText: {
    alignSelf: 'flex-end',
    color: '#838C97',
    fontSize: 12,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 12,
    textAlign: 'right',
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
