import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const loginAssets = {
  appMark: require('@/assets/images/login/app-mark.svg'),
  id: require('@/assets/images/login/id.svg'),
  google: require('@/assets/images/login/google.svg'),
  apple: require('@/assets/images/login/apple.svg'),
};

type LoginProvider = '아이디' | 'Google' | 'Apple';

interface LoginButtonProps {
  label: string;
  icon: ImageSource;
  primary?: boolean;
  onPress: () => void;
}

function LoginButton({
  label,
  icon,
  primary = false,
  onPress,
}: LoginButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.loginButton,
        primary && styles.primaryButton,
        pressed && styles.pressed,
      ]}>
      {!primary && (
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.10)', 'rgba(199, 199, 199, 0.10)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <View style={styles.buttonContent}>
        <View style={styles.buttonIconBox}>
          <Image
            source={icon}
            style={label === '아이디로 계속하기' ? styles.idIcon : styles.socialIcon}
            contentFit="fill"
          />
        </View>
        <Text style={[styles.buttonText, primary && styles.primaryButtonText]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function LoginScreen() {
  const login = (provider: LoginProvider): void => {
    // TODO: 실제 인증 방식 확정 후 공급자별 로그인과 사용자 세션 저장으로 교체
    void provider;
    router.replace('/home');
  };

  return (
    <LinearGradient colors={['#694FB1', '#B8B9E2']} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.intro}>
            <View style={styles.appIcon}>
              <Image
                source={loginAssets.appMark}
                style={styles.appMark}
                contentFit="fill"
              />
            </View>

            <View>
              <Text style={styles.titlePrimary}>바톤에서 </Text>
              <Text style={styles.titleSecondary}>중고 상품을</Text>
              <Text style={styles.titleSecondary}>한눈에 살펴봐요</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <View style={styles.loginButtons}>
              <LoginButton
                label="아이디로 계속하기"
                icon={loginAssets.id}
                primary
                onPress={() => login('아이디')}
              />
              <LoginButton
                label="Google로 계속하기"
                icon={loginAssets.google}
                onPress={() => login('Google')}
              />
              <LoginButton
                label="Apple로 계속하기"
                icon={loginAssets.apple}
                onPress={() => login('Apple')}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="로그인 없이 홈 둘러보기"
              hitSlop={10}
              onPress={() => router.replace('/home')}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.guestText}>로그인 없이 둘러보기</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 91,
    paddingHorizontal: 28,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },
  intro: {
    gap: 22,
  },
  appIcon: {
    width: 50,
    height: 50,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  appMark: {
    width: 39.043,
    height: 28.841,
  },
  titlePrimary: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 41.6,
    letterSpacing: -0.3,
  },
  titleSecondary: {
    color: 'rgba(255, 255, 255, 0.50)',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 41.6,
    letterSpacing: -0.3,
  },
  actions: {
    width: '100%',
    maxWidth: 304,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 28,
  },
  loginButtons: {
    width: '100%',
    gap: 12,
  },
  loginButton: {
    width: '100%',
    height: 51.083,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryButton: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonIconBox: {
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idIcon: {
    width: 17,
    height: 12.558,
  },
  socialIcon: {
    width: 17,
    height: 17,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: -0.042,
    textAlign: 'center',
  },
  primaryButtonText: {
    color: '#111727',
  },
  guestText: {
    width: 304,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: -0.042,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
