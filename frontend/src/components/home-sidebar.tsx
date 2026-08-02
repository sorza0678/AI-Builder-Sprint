import { Href, router } from 'expo-router';
import { Image, ImageSource } from 'expo-image';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/src/components/pretendard-text';

interface HomeSidebarProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuRowProps {
  label: string;
  icon: ImageSource;
  iconSize: {
    width: number;
    height: number;
  };
  href?: Href;
  onNavigate: (href: Href) => void;
}

function MenuRow({
  label,
  icon,
  iconSize,
  href,
  onNavigate,
}: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole={href ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !href }}
      disabled={!href}
      onPress={() => href && onNavigate(href)}
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
      <View style={styles.menuIconBox}>
        <Image source={icon} style={iconSize} contentFit="fill" />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );
}

export function HomeSidebar({ visible, onClose }: HomeSidebarProps) {
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(298, width * 0.828);

  const navigate = (href: Href): void => {
    onClose();
    router.push(href);
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.modalRoot}>
        <SafeAreaView style={[styles.panel, { width: panelWidth }]} edges={['top', 'bottom']}>
          <View style={styles.content}>
            <View style={styles.profile}>
              <Text style={styles.greeting}>반가워요!</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="로그인 화면으로 이동"
                onPress={() => navigate('/login')}
                style={({ pressed }) => [styles.loginLink, pressed && styles.pressed]}>
                <Text style={styles.loginText}>로그인 해주세요</Text>
                <Image
                  source={require('@/assets/images/sidebar/login-chevron.png')}
                  style={styles.loginChevron}
                  contentFit="fill"
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="마이페이지 미리보기"
                onPress={() => navigate('/mypage-preview')}
                style={({ pressed }) => [
                  styles.temporaryMyPageButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.temporaryMyPageText}>마이페이지 미리보기</Text>
                <Image
                  source={require('@/assets/images/sidebar/mypage-chevron.svg')}
                  style={styles.temporaryMyPageChevron}
                  contentFit="contain"
                />
              </Pressable>
            </View>

            <View style={styles.navigation}>
              <View style={styles.quickLinks}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="찜한상품"
                  onPress={() => navigate('/saved-listings')}
                  style={({ pressed }) => [styles.quickLink, styles.quickLinkDivider, pressed && styles.pressed]}>
                  <Text style={styles.quickLinkText}>찜한상품</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="분석기록"
                  onPress={() => navigate('/recent-analyses')}
                  style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]}>
                  <Text style={styles.quickLinkText}>분석기록</Text>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="바톤 사용법 보기"
                onPress={() => navigate('/onboarding')}
                style={({ pressed }) => [styles.guideCard, pressed && styles.pressed]}>
                <Image
                  source={require('@/assets/images/sidebar/guide-brand.png')}
                  style={styles.guideBrand}
                  contentFit="fill"
                />
                <View style={styles.guideLink}>
                  <Text style={styles.guideText}>바톤이 처음이신가요? </Text>
                  <Text style={styles.guideStrong}>사용법 보기</Text>
                  <Image
                    source={require('@/assets/images/sidebar/guide-chevron.svg')}
                    style={styles.guideChevron}
                    contentFit="fill"
                  />
                </View>
              </Pressable>

              <View style={styles.menuList}>
                <MenuRow
                  label="비교기록"
                  icon={require('@/assets/images/sidebar/comparison-history.svg')}
                  iconSize={{ width: 22.715, height: 22.125 }}
                  onNavigate={navigate}
                />
                <MenuRow
                  label="비교하기"
                  icon={require('@/assets/images/sidebar/compare.svg')}
                  iconSize={{ width: 23.667, height: 21.5 }}
                  href="/compare"
                  onNavigate={navigate}
                />
                <MenuRow
                  label="거래준비"
                  icon={require('@/assets/images/sidebar/clipboard-check.svg')}
                  iconSize={{ width: 19.333, height: 23.667 }}
                  href="/trade/mock-analysis-1"
                  onNavigate={navigate}
                />
                <MenuRow
                  label="거래내역"
                  icon={require('@/assets/images/sidebar/receipt.svg')}
                  iconSize={{ width: 19.333, height: 23.667 }}
                  href="/trade-records"
                  onNavigate={navigate}
                />
                <MenuRow
                  label="알림"
                  icon={require('@/assets/images/sidebar/bell.svg')}
                  iconSize={{ width: 21.834, height: 22.917 }}
                  onNavigate={navigate}
                />
                <MenuRow
                  label="설정"
                  icon={require('@/assets/images/sidebar/settings.svg')}
                  iconSize={{ width: 21.538, height: 23.667 }}
                  onNavigate={navigate}
                />
              </View>
            </View>
          </View>
        </SafeAreaView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="메뉴 닫기"
          onPress={onClose}
          style={styles.scrim}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(33, 33, 33, 0.6)',
  },
  panel: {
    height: '100%',
    backgroundColor: '#FFFCFF',
  },
  content: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 32,
  },
  profile: {
    paddingHorizontal: 4,
    gap: 2,
  },
  greeting: {
    color: '#797979',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19.5,
    letterSpacing: -0.3,
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
  },
  loginText: {
    color: '#212121',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  loginChevron: {
    width: 14,
    height: 14,
  },
  temporaryMyPageButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F0F0FA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  temporaryMyPageText: {
    color: '#6850A4',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16.9,
    letterSpacing: -0.3,
  },
  temporaryMyPageChevron: {
    width: 12,
    height: 12,
  },
  navigation: {
    gap: 24,
  },
  quickLinks: {
    height: 47,
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F6F5FA',
    flexDirection: 'row',
  },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkDivider: {
    borderRightWidth: 1,
    borderRightColor: '#E7E9EF',
  },
  quickLinkText: {
    color: '#212121',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 15,
    letterSpacing: -0.3,
  },
  guideCard: {
    height: 70,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: '#F0F0FA',
    justifyContent: 'center',
    gap: 10,
  },
  guideBrand: {
    width: 82.337,
    height: 18,
  },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guideText: {
    color: '#424242',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 13,
    letterSpacing: -0.3,
  },
  guideStrong: {
    color: '#212121',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 13,
    letterSpacing: -0.3,
  },
  guideChevron: {
    width: 4.5,
    height: 7.5,
    marginLeft: 5.25,
  },
  menuList: {
    gap: 2,
  },
  menuRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconBox: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    color: '#212121',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: -0.3,
  },
  scrim: {
    flex: 1,
  },
  pressed: {
    opacity: 0.65,
  },
});
