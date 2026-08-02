import { router } from 'expo-router';
import { Image, ImageSource } from 'expo-image';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/src/components/pretendard-text';
import { getMyPageSummary } from '@/src/services/mypage-service';
import { addBookmark, getBookmarks, removeBookmark } from '@/src/services/bookmark-service';
import type { HistoryItem, MyPageData } from '@/src/services/api-types';
import { getAuthSession, signOut } from '@/src/storage/auth-session-storage';

interface MenuItem {
  label: string;
  icon: ImageSource;
  onPress?: () => void;
}

const ACTIVITY_ITEMS: MenuItem[] = [
  { label: '찜한 상품', icon: require('@/assets/images/mypage/heart.svg'), onPress: () => router.push('/saved-listings') },
  { label: '분석 기록', icon: require('@/assets/images/mypage/analysis.svg'), onPress: () => router.push('/recent-analyses') },
  {
    label: '비교 기록',
    icon: require('@/assets/images/mypage/compare.svg'),
    onPress: () => router.push('/comparison-history'),
  },
];

const TRADE_ITEMS: MenuItem[] = [
  { label: '거래 준비', icon: require('@/assets/images/mypage/trade-ready.svg'), onPress: () => router.push('/recent-analyses?mode=trade') },
  { label: '거래 내역', icon: require('@/assets/images/sidebar/receipt.svg'), onPress: () => router.push('/trade-records') },
];

function ListingPreview({
  bookmarked,
  item,
  onToggleBookmark,
}: {
  bookmarked: boolean;
  item: HistoryItem;
  onToggleBookmark: (itemId: number, bookmarked: boolean) => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityLabel={`${item.title} 분석 기록 보기`}
      accessibilityRole="button"
      onPress={() => router.push(`/analysis/${item.item_id}`)}
      style={({ pressed }) => [styles.listingCard, pressed && styles.pressed]}>
      <View style={styles.listingInfo}>
        <Text numberOfLines={1} style={styles.listingLocation}>
          {item.location ?? item.platform ?? '지역 정보 없음'}
        </Text>
        <View style={styles.listingDetails}>
          <Text style={styles.listingPrice}>{item.price.toLocaleString('ko-KR')}원</Text>
          <Text numberOfLines={1} style={styles.listingTitle}>
            {item.title}
          </Text>
        </View>
      </View>
      <View style={styles.listingFooter}>
        <Text style={styles.listingTime}>{formatRelativeTime(item.created_at)}</Text>
      </View>
      <Pressable
        accessibilityLabel={bookmarked ? `${item.title} 찜 취소` : `${item.title} 찜하기`}
        accessibilityRole="button"
        accessibilityState={{ selected: bookmarked }}
        hitSlop={4}
        onPress={(event) => {
          event.stopPropagation();
          void onToggleBookmark(item.item_id, bookmarked);
        }}
        style={({ pressed }) => [styles.cardFavorite, pressed && styles.pressed]}>
        <Image
          contentFit="contain"
          source={bookmarked
            ? require('@/assets/images/mypage/listing-heart-filled.svg')
            : require('@/assets/images/mypage/listing-heart.svg')}
          style={styles.cardFavoriteIcon}
        />
      </Pressable>
    </Pressable>
  );
}

function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '방금 전';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / 1440)}일 전`;
}

function ListingSection({
  bookmarkedIds,
  title,
  items,
  onToggleBookmark,
}: {
  bookmarkedIds: Set<number>;
  title: string;
  items: HistoryItem[];
  onToggleBookmark: (itemId: number, bookmarked: boolean) => Promise<void>;
}) {
  return (
    <View style={styles.listingSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView
        contentContainerStyle={styles.listingRow}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {items.map((item) => (
          <ListingPreview
            bookmarked={bookmarkedIds.has(item.item_id)}
            item={item}
            key={item.item_id}
            onToggleBookmark={onToggleBookmark}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function MenuSection({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <View style={styles.menuSection}>
      <Text style={styles.menuSectionTitle}>{title}</Text>
      {items.map((item) => (
        <Pressable
          accessibilityLabel={item.label}
          accessibilityRole="button"
          key={item.label}
          onPress={item.onPress ?? (() => undefined)}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <View style={styles.menuIconBox}>
            <Image contentFit="contain" source={item.icon} style={styles.menuIcon} />
          </View>
          <Text style={styles.menuLabel}>{item.label}</Text>
          <View style={styles.menuChevronBox}>
            <Image
              contentFit="contain"
              source={require('@/assets/images/mypage/chevron.svg')}
              style={styles.menuChevron}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function MyPageScreen() {
  const [summary, setSummary] = useState<MyPageData>();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [accountId, setAccountId] = useState('');
  useFocusEffect(useCallback(() => {
    void getAuthSession().then((session) => {
      if (!session) {
        router.replace('/login');
        return;
      }
      setAccountId(session.accountId);
      void Promise.all([getMyPageSummary(), getBookmarks()])
        .then(([nextSummary, bookmarks]) => {
          setSummary(nextSummary);
          setHistory(nextSummary.recent_analyses);
          setBookmarkedIds(new Set(bookmarks.items.map((item) => item.item_id)));
        })
        .catch(() => undefined);
    });
  }, []));

  const toggleBookmark = async (itemId: number, bookmarked: boolean): Promise<void> => {
    if (bookmarked) await removeBookmark(itemId);
    else await addBookmark(itemId);
    setBookmarkedIds((current) => {
      const next = new Set(current);
      if (bookmarked) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    setSummary((current) => current ? {
      ...current,
      bookmark_count: Math.max(0, current.bookmark_count + (bookmarked ? -1 : 1)),
    } : current);
  };

  const accountItems: MenuItem[] = [
    { label: '설정', icon: require('@/assets/images/sidebar/settings.svg') },
    {
      label: '로그아웃',
      icon: require('@/assets/images/mypage/logout.svg'),
      onPress: () => void signOut().then(() => router.replace('/home')),
    },
  ];
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Image
            contentFit="contain"
            source={require('@/assets/images/analysis-input/arrow-left.svg')}
            style={styles.backIcon}
          />
        </Pressable>
        <Text style={styles.headerTitle}>마이페이지</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <Image
            accessibilityLabel="프로필 이미지"
            contentFit="contain"
            source={require('@/assets/images/mypage/avatar.svg')}
            style={styles.avatar}
          />
          <Text style={styles.userName}>{accountId ? `${accountId} 님` : '불러오는 중...'}</Text>
          <Pressable
            accessibilityLabel="내 정보 수정"
            accessibilityRole="button"
            onPress={() => undefined}
            style={({ pressed }) => [styles.editProfileButton, pressed && styles.pressed]}>
            <Text style={styles.editProfileText}>내 정보 수정</Text>
          </Pressable>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>분석 완료</Text>
              <Text style={styles.statValue}>{summary ? `${summary.analysis_count}개` : '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>찜한 매물</Text>
              <Text style={styles.statValue}>{summary ? `${summary.bookmark_count}개` : '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>거래 완료</Text>
              <Text style={styles.statValue}>{summary ? `${summary.transaction_completed_count}개` : '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.listingsArea}>
          <ListingSection
            bookmarkedIds={bookmarkedIds}
            items={history}
            onToggleBookmark={toggleBookmark}
            title="최근 분석 기록"
          />
          {history.length === 0 && <Text style={styles.emptyText}>아직 분석 기록이 없습니다.</Text>}
        </View>

        <View style={styles.separator} />
        <View style={styles.menuArea}>
          <MenuSection items={ACTIVITY_ITEMS} title="내 활동" />
          <MenuSection items={TRADE_ITEMS} title="내 거래" />
          <MenuSection items={accountItems} title="계정" />
          <Pressable
            accessibilityLabel="회원 탈퇴"
            accessibilityRole="button"
            onPress={() => undefined}
            style={({ pressed }) => [styles.withdrawButton, pressed && styles.pressed]}>
            <Text style={styles.withdrawText}>회원탈퇴</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backIcon: { width: 24, height: 24 },
  headerTitle: {
    color: '#111727',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 23.4,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 40 },
  scrollContent: { paddingBottom: 100 },
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    alignItems: 'center',
  },
  avatar: { width: 84, height: 84 },
  userName: {
    marginTop: 12,
    color: '#111727',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  editProfileButton: {
    minWidth: 84,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 20,
    alignItems: 'center',
  },
  editProfileText: {
    color: '#515760',
    fontSize: 12,
    lineHeight: 15.6,
    letterSpacing: -0.3,
  },
  statsCard: {
    width: '100%',
    minHeight: 78,
    marginTop: 24,
    paddingVertical: 20,
    borderRadius: 10,
    backgroundColor: '#F4F6FA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 38, backgroundColor: '#D2D2E2' },
  statLabel: {
    color: '#838C97',
    fontSize: 12,
    lineHeight: 15.6,
    letterSpacing: -0.3,
  },
  statValue: {
    color: '#484B4D',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 23.4,
    letterSpacing: -0.3,
  },
  listingsArea: { paddingTop: 28, paddingBottom: 32, gap: 28 },
  listingSection: { gap: 16 },
  sectionTitle: {
    paddingHorizontal: 16,
    color: '#111727',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20.8,
    letterSpacing: -0.3,
  },
  listingRow: { paddingHorizontal: 16, gap: 10 },
  listingCard: {
    width: 165,
    height: 141,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#EFF0FF',
    justifyContent: 'space-between',
  },
  listingInfo: {
    height: 73,
    paddingTop: 4,
    justifyContent: 'space-between',
  },
  listingDetails: {
    gap: 6,
  },
  listingLocation: {
    color: '#838C97',
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: -0.3,
  },
  cardFavorite: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFavoriteIcon: {
    width: 19.355,
    height: 19.355,
  },
  listingPrice: {
    color: '#484B4D',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: -0.3,
  },
  listingTitle: {
    color: '#8656C2',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21.6,
    letterSpacing: -0.3,
  },
  listingFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listingTime: {
    color: '#515760',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: -0.3,
  },
  emptyText: {
    paddingHorizontal: 16,
    color: '#838C97',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  separator: { height: 8, backgroundColor: '#F6F5FA' },
  menuArea: { paddingHorizontal: 16 },
  menuSection: { paddingTop: 20 },
  menuSectionTitle: {
    paddingBottom: 12,
    color: '#212121',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20.8,
    letterSpacing: -0.3,
  },
  menuRow: {
    minHeight: 62,
    paddingLeft: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { width: 22, height: 22 },
  menuLabel: {
    flex: 1,
    marginLeft: 15,
    color: '#111727',
    fontSize: 15,
    lineHeight: 19.5,
    letterSpacing: -0.3,
  },
  menuChevronBox: {
    width: 18,
    height: 18,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuChevron: {
    width: 12,
    height: 6.75,
    transform: [{ rotate: '-90deg' }],
  },
  withdrawButton: {
    alignSelf: 'center',
    marginTop: 40,
    padding: 10,
  },
  withdrawText: {
    color: '#838C97',
    fontSize: 14,
    lineHeight: 18.2,
    letterSpacing: -0.3,
  },
  pressed: { opacity: 0.65 },
});
