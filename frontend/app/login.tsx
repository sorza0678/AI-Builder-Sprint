import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/src/components/pretendard-text';
import { getAuthSession, signInWithMockAccount } from '@/src/storage/auth-session-storage';
import { getOrCreateDeviceGuestId } from '@/src/storage/guest-id-storage';

const loginAssets = {
  appMark: require('@/assets/images/login/app-mark.svg'),
  id: require('@/assets/images/login/id.svg'),
  google: require('@/assets/images/login/google.svg'),
  apple: require('@/assets/images/login/apple.svg'),
};

function LoginButton({
  label,
  icon,
  primary = false,
  onPress,
}: {
  label: string;
  icon: ImageSource;
  primary?: boolean;
  onPress: () => void;
}) {
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
      <View style={styles.buttonContent}>
        <Image source={icon} style={primary ? styles.idIcon : styles.socialIcon} contentFit="fill" />
        <Text style={[styles.buttonText, primary && styles.primaryButtonText]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default function LoginScreen() {
  const [showIdLogin, setShowIdLogin] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    void getAuthSession().then((session) => {
      if (session) router.replace('/mypage');
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const guestId = await getOrCreateDeviceGuestId();
      const session = await signInWithMockAccount(accountId, password, guestId);
      if (!session) {
        setError('아이디 또는 비밀번호를 확인해 주세요.');
        return;
      }
      router.replace('/mypage');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#694FB1', '#B8B9E2']} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardArea}>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              showIdLogin && styles.formContent,
              keyboardVisible && styles.keyboardVisibleContent,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {!keyboardVisible && <View style={styles.intro}>
            <View style={styles.appIcon}>
              <Image source={loginAssets.appMark} style={styles.appMark} contentFit="fill" />
            </View>
            <View>
              <Text style={styles.titlePrimary}>바톤에서 </Text>
              <Text style={styles.titleSecondary}>중고 상품을</Text>
              <Text style={styles.titleSecondary}>더 눈여겨 살펴봐요</Text>
            </View>
            </View>}

            <View style={[styles.actions, keyboardVisible && styles.keyboardVisibleActions]}>
            {showIdLogin ? (
              <View style={styles.formCard}>
                <View style={styles.formHeading}>
                  <Text style={styles.formTitle}>아이디로 로그인</Text>
                  <Text style={styles.formDescription}>테스트 계정으로 마이페이지를 확인해 보세요.</Text>
                </View>
                <View style={styles.fields}>
                  <TextInput
                    accessibilityLabel="아이디"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(value) => { setAccountId(value); setError(''); }}
                    placeholder="아이디"
                    placeholderTextColor="#9EA3AD"
                    returnKeyType="next"
                    style={styles.input}
                    value={accountId}
                  />
                  <TextInput
                    accessibilityLabel="비밀번호"
                    onChangeText={(value) => { setPassword(value); setError(''); }}
                    onSubmitEditing={() => void submit()}
                    placeholder="비밀번호"
                    placeholderTextColor="#9EA3AD"
                    returnKeyType="done"
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                  <Text style={styles.errorText}>{error || ' '}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={() => void submit()}
                  style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
                  <Text style={styles.submitText}>{submitting ? '로그인 중...' : '로그인'}</Text>
                </Pressable>
                <Pressable onPress={() => setShowIdLogin(false)} style={styles.backToOptions}>
                  <Text style={styles.backToOptionsText}>다른 방법으로 로그인</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.loginButtons}>
                <LoginButton label="아이디로 계속하기" icon={loginAssets.id} primary onPress={() => setShowIdLogin(true)} />
                <LoginButton label="Google로 계속하기 (지원 예정)" icon={loginAssets.google} onPress={() => undefined} />
                <LoginButton label="Apple로 계속하기 (지원 예정)" icon={loginAssets.apple} onPress={() => undefined} />
              </View>
            )}
            <Pressable onPress={() => router.replace('/home')} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.guestText}>로그인 없이 둘러보기</Text>
            </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardArea: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 64, paddingHorizontal: 28, paddingBottom: 30, justifyContent: 'space-between', gap: 36 },
  formContent: { paddingTop: 36 },
  keyboardVisibleContent: { justifyContent: 'flex-start', paddingTop: 16, paddingBottom: 16, gap: 0 },
  intro: { gap: 22 },
  appIcon: { width: 50, height: 50, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  appMark: { width: 39.043, height: 28.841 },
  titlePrimary: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', lineHeight: 41.6, letterSpacing: -0.3 },
  titleSecondary: { color: 'rgba(255,255,255,0.50)', fontSize: 32, fontWeight: '700', lineHeight: 41.6, letterSpacing: -0.3 },
  actions: { width: '100%', maxWidth: 340, alignSelf: 'center', alignItems: 'center', gap: 24 },
  keyboardVisibleActions: { marginTop: 0 },
  loginButtons: { width: '100%', gap: 12 },
  loginButton: { width: '100%', height: 51, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  idIcon: { width: 17, height: 13 },
  socialIcon: { width: 17, height: 17 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  primaryButtonText: { color: '#111727' },
  formCard: { width: '100%', padding: 22, borderRadius: 24, backgroundColor: '#FFFFFF', gap: 16 },
  formHeading: { gap: 5 },
  formTitle: { color: '#111727', fontSize: 20, fontWeight: '600', lineHeight: 26 },
  formDescription: { color: '#838C97', fontSize: 13, lineHeight: 18 },
  fields: { gap: 10 },
  input: { height: 50, borderWidth: 1, borderColor: '#E7E9EF', borderRadius: 12, paddingHorizontal: 16, color: '#111727', backgroundColor: '#FAFAFC', fontFamily: 'Pretendard-Regular', fontSize: 15 },
  errorText: { minHeight: 17, color: '#D54949', fontSize: 12, lineHeight: 17 },
  submitButton: { height: 50, borderRadius: 25, backgroundColor: '#8656C2', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  backToOptions: { alignSelf: 'center', padding: 4 },
  backToOptionsText: { color: '#6850A4', fontSize: 13 },
  guestText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
