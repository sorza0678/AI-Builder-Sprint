import { useCallback, useEffect, useMemo, useState } from 'react';
import { Href, router } from 'expo-router';
import { Image } from 'expo-image';
import {
  Pressable,
  SectionList,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/src/components/pretendard-text';
import { getComparisonHistory } from '@/src/repositories/comparison-history-repository';
import type { ComparisonHistorySnapshot } from '@/src/storage/storage-types';

type ComparisonThumbnailKind = 'macbook' | 'placeholder';

interface ComparisonProductItem {
  id: string;
  title: string;
  price: string;
  thumbnail: ComparisonThumbnailKind;
}

interface ComparisonHistoryItem {
  id: string;
  href: Href;
  title: string;
  recommendation: string;
  products: ComparisonProductItem[];
}

interface ComparisonHistorySection {
  title: string;
  data: ComparisonHistoryItem[];
}

const assets = {
  arrow: require('@/assets/images/recent-analyses/arrow-left.svg'),
  chevron: require('@/assets/images/recent-analyses/chevron.svg'),
  macbook: require('@/assets/images/recent-analyses/macbook.png'),
  placeholder: require('@/assets/images/recent-analyses/placeholder-mark.svg'),
  search: require('@/assets/images/recent-analyses/search.svg'),
};

const MOCK_COMPARISON_SECTIONS: ComparisonHistorySection[] = [
  {
    title: '8월 1일',
    data: [
      {
        id: 'mock-comparison-1',
        href: '/compare',
        title: 'Enkei RPF1 17인치 외 2개',
        recommendation: 'Enkei RPF1 추천',
        products: [
          {
            id: 'mock-comparison-1-product-1',
            title: '맥북프로 14 M2 pro 16기가 512기가',
            price: '1,850,000원',
            thumbnail: 'macbook',
          },
          {
            id: 'mock-comparison-1-product-2',
            title: 'BBS RS 18인치',
            price: '600,000원',
            thumbnail: 'placeholder',
          },
          {
            id: 'mock-comparison-1-product-3',
            title: 'BBS RS 18인치',
            price: '600,000원',
            thumbnail: 'placeholder',
          },
        ],
      },
      {
        id: 'mock-comparison-2',
        href: '/compare',
        title: '맥북프로 14 M2 pro 16기가 512기가 외 1개',
        recommendation: 'BBS RS 18인치 추천',
        products: [
          {
            id: 'mock-comparison-2-product-1',
            title: '맥북프로 14 M2 pro 16기가 512기가',
            price: '1,850,000원',
            thumbnail: 'macbook',
          },
          {
            id: 'mock-comparison-2-product-2',
            title: 'BBS RS 18인치',
            price: '600,000원',
            thumbnail: 'placeholder',
          },
        ],
      },
    ],
  },
  {
    title: '7월 31일',
    data: [
      {
        id: 'mock-comparison-3',
        href: '/compare',
        title: 'Enkei RPF1 17인치 외 2개',
        recommendation: 'Enkei RPF1 추천',
        products: [
          {
            id: 'mock-comparison-3-product-1',
            title: '맥북프로 14 M2 pro 16기가 512기가',
            price: '1,850,000원',
            thumbnail: 'macbook',
          },
          {
            id: 'mock-comparison-3-product-2',
            title: 'BBS RS 18인치',
            price: '600,000원',
            thumbnail: 'placeholder',
          },
          {
            id: 'mock-comparison-3-product-3',
            title: 'BBS RS 18인치',
            price: '600,000원',
            thumbnail: 'placeholder',
          },
        ],
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

function getComparisonTitle(item: ComparisonHistorySnapshot): string {
  const firstTitle = item.itemSnapshots[0]?.title ?? '비교 상품';
  const extraCount = Math.max(0, item.itemSnapshots.length - 1);

  return extraCount > 0 ? `${firstTitle} 외 ${extraCount}개` : firstTitle;
}

function mapComparisonHistory(item: ComparisonHistorySnapshot): ComparisonHistoryItem {
  return {
    id: item.localId,
    href: '/compare',
    title: getComparisonTitle(item),
    recommendation: item.recommendation,
    products: item.itemSnapshots.slice(0, 3).map((snapshot, index) => ({
      id: `${item.localId}-${snapshot.serverItemId}`,
      title: snapshot.title,
      price: `${snapshot.price.toLocaleString('ko-KR')}원`,
      thumbnail: index === 0 ? 'macbook' : 'placeholder',
    })),
  };
}

function groupComparisonHistory(items: ComparisonHistorySnapshot[]): ComparisonHistorySection[] {
  const sections = new Map<string, ComparisonHistoryItem[]>();

  items.forEach((item) => {
    const dateLabel = formatDateLabel(item.createdAt);
    const sectionItems = sections.get(dateLabel) ?? [];
    sectionItems.push(mapComparisonHistory(item));
    sections.set(dateLabel, sectionItems);
  });

  return Array.from(sections.entries()).map(([title, data]) => ({ title, data }));
}

function mergeSections(
  primarySections: ComparisonHistorySection[],
  sampleSections: ComparisonHistorySection[],
): ComparisonHistorySection[] {
  const merged = new Map<string, ComparisonHistoryItem[]>();

  [...primarySections, ...sampleSections].forEach((section) => {
    merged.set(section.title, [...(merged.get(section.title) ?? []), ...section.data]);
  });

  return Array.from(merged.entries()).map(([title, data]) => ({ title, data }));
}

function filterSections(
  sections: ComparisonHistorySection[],
  query: string,
): ComparisonHistorySection[] {
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) {
    return sections;
  }

  return sections
    .map((section) => ({
      ...section,
      data: section.data.filter((item) =>
        `${item.title} ${item.recommendation} ${item.products
          .map((product) => `${product.title} ${product.price}`)
          .join(' ')}`
          .toLowerCase()
          .includes(trimmedQuery),
      ),
    }))
    .filter((section) => section.data.length > 0);
}

function splitRecommendation(value: string): { productName: string; suffix: string } {
  const trimmedValue = value.trim();
  const suffix = '추천';

  if (!trimmedValue.endsWith(suffix)) {
    return { productName: trimmedValue, suffix };
  }

  return {
    productName: trimmedValue.slice(0, -suffix.length).trim(),
    suffix,
  };
}

export default function ComparisonHistoryScreen() {
  const [historyItems, setHistoryItems] = useState<ComparisonHistorySnapshot[]>([]);
  const [query, setQuery] = useState('');
  const [isListScrolled, setIsListScrolled] = useState(false);

  const load = useCallback(() => {
    getComparisonHistory().then(setHistoryItems);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    const source = mergeSections(
      groupComparisonHistory(historyItems),
      MOCK_COMPARISON_SECTIONS,
    );
    return filterSections(source, query);
  }, [historyItems, query]);

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
        <Text style={styles.headerTitle}>비교 기록</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={[styles.searchArea, isListScrolled && styles.searchAreaScrolled]}>
        <View style={styles.searchBox}>
          <TextInput
            accessibilityLabel="비교 기록 검색"
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
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {query ? '검색 결과가 없습니다.' : '비교 기록이 없습니다.'}
          </Text>
        }
        onScroll={(event) => {
          const nextIsScrolled = event.nativeEvent.contentOffset.y > 0;
          setIsListScrolled((current) =>
            current === nextIsScrolled ? current : nextIsScrolled,
          );
        }}
        renderItem={({ item }) => <ComparisonHistoryCard item={item} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        scrollEventThrottle={16}
        sections={sections}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        style={styles.list}
      />
    </SafeAreaView>
  );
}

function ComparisonHistoryCard({ item }: { item: ComparisonHistoryItem }) {
  const recommendation = splitRecommendation(item.recommendation);
  const { width } = useWindowDimensions();
  const productSize = Math.floor((width - 40 - 8) / 3);

  return (
    <Pressable
      accessibilityLabel={`${item.title} 비교 기록 보기`}
      accessibilityRole="button"
      onPress={() => router.push(item.href)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {item.title}
        </Text>
        <View style={styles.recommendation}>
          <Text numberOfLines={1} style={styles.recommendationProduct}>
            {recommendation.productName}
          </Text>
          <Text style={styles.recommendationSuffix}>
            {recommendation.suffix}
          </Text>
          <View style={styles.chevronBox}>
            <Image contentFit="contain" source={assets.chevron} style={styles.chevronIcon} />
          </View>
        </View>
      </View>
      <View style={styles.productList}>
        {item.products.map((product) => (
          <ComparisonProductCard key={product.id} product={product} size={productSize} />
        ))}
      </View>
    </Pressable>
  );
}

function ComparisonProductCard({
  product,
  size,
}: {
  product: ComparisonProductItem;
  size: number;
}) {
  return (
    <View style={[styles.productCard, { width: size }]}>
      <ComparisonThumbnail thumbnail={product.thumbnail} />
      <View style={styles.productTextGroup}>
        <Text numberOfLines={1} style={styles.productTitle}>
          {product.title}
        </Text>
        <Text numberOfLines={1} style={styles.productPrice}>
          {product.price}
        </Text>
      </View>
    </View>
  );
}

function ComparisonThumbnail({ thumbnail }: { thumbnail: ComparisonThumbnailKind }) {
  if (thumbnail === 'placeholder') {
    return (
      <View style={styles.placeholderThumbnail}>
        <View style={styles.placeholderIconBox}>
          <Image contentFit="contain" source={assets.placeholder} style={styles.placeholderIcon} />
        </View>
      </View>
    );
  }

  return <Image contentFit="cover" source={assets.macbook} style={styles.thumbnail} />;
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
  sectionHeader: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#111727',
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 16,
  },
  card: {
    paddingBottom: 16,
    width: '100%',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    width: '100%',
  },
  cardTitle: {
    color: '#515760',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 15,
    marginRight: 12,
    minWidth: 0,
  },
  recommendation: {
    alignItems: 'center',
    flexShrink: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  recommendationProduct: {
    color: '#838C97',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 13,
    minWidth: 0,
  },
  recommendationSuffix: {
    color: '#838C97',
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 13,
    marginLeft: 4,
  },
  chevronBox: {
    alignItems: 'center',
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  chevronIcon: {
    height: 6.75,
    transform: [{ rotate: '-90deg' }],
    width: 12,
  },
  productList: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
  },
  productCard: {
    gap: 11,
  },
  thumbnail: {
    aspectRatio: 1,
    borderRadius: 12.84,
    width: '100%',
  },
  placeholderThumbnail: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: '#F4F6FA',
    borderRadius: 12.84,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  placeholderIconBox: {
    alignItems: 'center',
    height: 74.469,
    justifyContent: 'center',
    width: 74.469,
  },
  placeholderIcon: {
    height: 42.955,
    width: 58.151,
  },
  productTextGroup: {
    gap: 7,
    paddingRight: 6,
    width: '100%',
  },
  productTitle: {
    color: '#111727',
    fontSize: 12,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 12,
  },
  productPrice: {
    color: '#838C97',
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 13,
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
