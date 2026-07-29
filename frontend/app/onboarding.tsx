import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { AppButton, commonStyles, ScreenContainer } from '@/src/components/common';

export default function OnboardingScreen() {
  return <ScreenContainer scroll={false}><View style={{ flex: 1, justifyContent: 'center' }}><Text style={commonStyles.title}>중고 거래 분석 도우미</Text><Text style={commonStyles.subtitle}>매물 정보를 정리하고 시세, 상태, 거래 위험 신호를 한 번에 확인하세요.</Text></View><AppButton title="시작하기" onPress={() => router.push('/login')} /></ScreenContainer>;
}
