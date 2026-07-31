import { router } from 'expo-router';
import { Image, ImageSource } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/src/components/pretendard-text';

import {
  MY_PAGE_HISTORY,
  MY_PAGE_RECOMMENDATIONS,
  MyPageListing,
} from '@/src/mocks/mypage';

interface MenuItem {
  label: string;
  icon: ImageSource;
  onPress?: () => void;
}

const ACTIVITY_ITEMS: MenuItem[] = [
  { label: '찜한 상품', icon: require('@/assets/images/mypage/heart.svg') },
  { label: '분석 기록', icon: require('@/assets/images/mypage/analysis.svg') },
  {
    label: '비교 기록',
    icon: require('@/assets/images/mypage/compare.svg'),
    onPress: () => router.push('/compare'),
  },
];

const TRADE_ITEMS: MenuItem[] = [
  { label: '거래 준비', icon: require('@/assets/images/mypage/trade-ready.svg') },
  { label: '거래 내역', icon: require('@/assets/images/sidebar/receipt.svg') },
];

const ACCOUNT_ITEMS: MenuItem[] = [
  { label: '설정', icon: require('@/assets/images/sidebar/settings.svg') },
  {
    label: '로그아웃',
    icon: require('@/assets/images/mypage/logout.svg'),
    onPress: () => router.replace('/login'),
  },
];

function ListingPreview({
  item,
  initiallySelected = false,
}: {
  item: MyPageListing;
  initiallySelected?: boolean;
}) {
  const [selected, setSelected] = useState(initiallySelected);
  const [favorite, setFavorite] = useState(false);

  return (
    <Pressable
      accessibilityLabel={`${item.title} 카드 선택`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => setSelected((current) => !current)}
      style={({ pressed }) => [
        styles.listingCard,
        selected && styles.listingCardHighlighted,
        pressed && styles.pressed,
      ]}>
      <View style={styles.listingTop}>
        <Text style={styles.listingLocation}>{item.location}</Text>
        <Pressable
          accessibilityLabel={`${item.title} ${favorite ? '찜 취소' : '찜하기'}`}
          accessibilityRole="button"
          accessibilityState={{ selected: favorite }}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            setFavorite((current) => !current);
          }}
          style={({ pressed }) => [styles.cardFavorite, pressed && styles.pressed]}>
          <Image
            contentFit="contain"
            source={
              favorite
                ? require('@/assets/images/mypage/listing-heart-filled.svg')
                : require('@/assets/images/mypage/listing-heart.svg')
            }
            style={styles.cardFavoriteIcon}
          />
        </Pressable>
      </View>
      <Text style={styles.listingPrice}>{item.price}</Text>
      <Text numberOfLines={1} style={styles.listingTitle}>
        {item.title}
      </Text>
      <View style={styles.listingFooter}>
        <Text style={styles.listingTime}>{item.time}</Text>
        {item.recommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>추천</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ListingSection({
  title,
  items,
  initiallySelectedFirst = false,
}: {
  title: string;
  items: MyPageListing[];
  initiallySelectedFirst?: boolean;
}) {
  return (
    <View style={styles.listingSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView
        contentContainerStyle={styles.listingRow}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {items.map((item, index) => (
          <ListingPreview
            initiallySelected={initiallySelectedFirst && index === 0}
            item={item}
            key={item.id}
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
          <Text style={styles.userName}>qweasd101 님</Text>
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
              <Text style={styles.statValue}>38개</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>찜한 매물</Text>
              <Text style={styles.statValue}>12개</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>거래 완료</Text>
              <Text style={styles.statValue}>7개</Text>
            </View>
          </View>
        </View>

        <View style={styles.listingsArea}>
          <ListingSection items={MY_PAGE_RECOMMENDATIONS} title="추천" />
          <ListingSection initiallySelectedFirst items={MY_PAGE_HISTORY} title="기록" />
        </View>

        <View style={styles.separator} />
        <View style={styles.menuArea}>
          <MenuSection items={ACTIVITY_ITEMS} title="내 활동" />
          <MenuSection items={TRADE_ITEMS} title="내 거래" />
          <MenuSection items={ACCOUNT_ITEMS} title="계정" />
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
    backgroundColor: '#F4F6FA',
  },
  listingCardHighlighted: { backgroundColor: '#EFF0FF' },
  listingTop: {
    height: 25,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  listingLocation: {
    color: '#838C97',
    fontSize: 11,
    lineHeight: 14.3,
    letterSpacing: -0.3,
  },
  cardFavorite: {
    width: 40,
    height: 40,
    marginTop: -10,
    marginRight: -10,
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
    lineHeight: 18.2,
    letterSpacing: -0.3,
  },
  listingTitle: {
    marginTop: 5,
    color: '#111727',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20.8,
    letterSpacing: -0.3,
  },
  listingFooter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  listingTime: {
    color: '#515760',
    fontSize: 14,
    lineHeight: 18.2,
    letterSpacing: -0.3,
  },
  recommendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#E4DDF8',
  },
  recommendedText: {
    color: '#8656C2',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 13,
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
