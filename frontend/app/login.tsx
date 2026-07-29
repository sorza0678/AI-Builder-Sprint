import { router } from 'expo-router';
import { Text } from 'react-native';
import { AppButton, commonStyles, ScreenContainer } from '@/src/components/common';

export default function LoginScreen() {
  const login = (provider: '카카오' | '네이버' | '구글') => {
    // TODO: 실제 소셜 로그인 연동 후 사용자 세션 저장
    void provider;
    router.replace('/home');
  };
  return <ScreenContainer><Text style={commonStyles.title}>로그인</Text><Text style={commonStyles.subtitle}>계정을 연결해 분석 기록과 저장한 매물을 관리하세요.</Text><AppButton title="카카오 로그인" onPress={() => login('카카오')} /><AppButton title="네이버 로그인" variant="secondary" onPress={() => login('네이버')} /><AppButton title="구글 로그인" variant="secondary" onPress={() => login('구글')} /></ScreenContainer>;
}
