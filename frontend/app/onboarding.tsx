import { useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/src/components/pretendard-text';
import { markOnboardingCompleted } from '@/src/utils/onboarding-storage';

const stepOneScreen = require('@/assets/images/onboarding/step-1-screen.png');
const stepTwoScreen = require('@/assets/images/onboarding/step-2-screen.png');
const stepThreeScreen = require('@/assets/images/onboarding/step-3-screen.png');
const stepFourScreen = require('@/assets/images/onboarding/step-4-screen.png');
const onboardingHand = require('@/assets/images/onboarding/step-1-hand.png');
const closeIcon = require('@/assets/images/onboarding/close.svg');

type OnboardingStep = 1 | 2 | 3 | 4;

const onboardingSteps: OnboardingStep[] = [1, 2, 3, 4];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState<OnboardingStep>(1);
  const isStepFour = step === 4;

  const moveToStep = (nextStep: OnboardingStep): void => {
    setStep(nextStep);
    scrollRef.current?.scrollTo({
      x: width * (nextStep - 1),
      y: 0,
      animated: true,
    });
  };

  const completeOnboarding = async (): Promise<void> => {
    try {
      await markOnboardingCompleted();
    } catch {
      // 저장 실패가 온보딩 종료와 홈 진입을 막지 않도록 합니다.
    }
    router.replace('/home');
  };

  const handleNext = (): void => {
    if (step < 4) {
      moveToStep(onboardingSteps[step]);
    } else {
      void completeOnboarding();
    }
  };

  const handleSwipeEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ): void => {
    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    const visibleStep = onboardingSteps[pageIndex];
    if (visibleStep) {
      setStep(visibleStep);
    }
  };

  const renderPage = (page: OnboardingStep) => {
    const isStepTwo = page === 2;
    const isStepThree = page === 3;
    const isStepFourPage = page === 4;
    const screenSource =
      page === 1
        ? stepOneScreen
        : page === 2
          ? stepTwoScreen
          : page === 3
            ? stepThreeScreen
            : stepFourScreen;
    const title =
      page === 1
        ? `궁금한 상품,\n링크만 가져오세요`
        : page === 2
          ? `AI가 상품 정보를\n먼저 정리해드려요`
          : page === 3
            ? `가격과 상태를\n한눈에 확인해보세요`
            : `거래 전 준비도\n한곳에서 끝내세요`;

    return (
      <View key={page} style={[styles.page, { width }]}>
        <View style={styles.guide}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.visual}>
            <View style={styles.screenClip}>
              <Image
                source={screenSource}
                style={[
                  styles.screenImage,
                  isStepTwo && styles.stepTwoScreenImage,
                  isStepThree && styles.stepThreeScreenImage,
                  isStepFourPage && styles.stepFourScreenImage,
                ]}
                contentFit="fill"
              />
              <LinearGradient
                colors={['rgba(242, 242, 242, 0)', '#F2F2F2']}
                locations={[0.376, 0.752]}
                style={styles.screenFade}
                pointerEvents="none"
              />
            </View>

            <View
              style={[
                styles.highlight,
                isStepTwo && styles.stepTwoHighlight,
                isStepThree && styles.stepThreeHighlight,
                isStepFourPage && styles.stepFourHighlight,
              ]}>
              <Image
                source={screenSource}
                style={[
                  styles.highlightImage,
                  isStepTwo && styles.stepTwoHighlightImage,
                  isStepThree && styles.stepThreeHighlightImage,
                  isStepFourPage && styles.stepFourHighlightImage,
                ]}
                contentFit="fill"
              />
            </View>

            {(page === 1 || page === 4) && (
              <View
                style={[
                  styles.handBox,
                  isStepFourPage && styles.stepFourHandBox,
                ]}
                pointerEvents="none">
                <Image
                  source={onboardingHand}
                  style={styles.handImage}
                  contentFit="fill"
                />
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View
          accessible
          style={styles.progress}
          accessibilityLabel={`온보딩 ${step}단계, 전체 4단계`}>
          {onboardingSteps.map((page) => (
            <View
              key={page}
              style={[styles.progressDot, page === step && styles.activeDot]}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="온보딩 닫기"
          hitSlop={10}
          onPress={() => {
            void completeOnboarding();
          }}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <Image source={closeIcon} style={styles.closeIcon} contentFit="fill" />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        disableIntervalMomentum
        onMomentumScrollEnd={handleSwipeEnd}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        style={styles.content}>
        {onboardingSteps.map(renderPage)}
      </ScrollView>

      <LinearGradient
        colors={['rgba(242, 242, 242, 0)', '#F2F2F2']}
        locations={[0, 0.19]}
        style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isStepFour ? '바톤 시작하기' : '다음 온보딩 페이지'}
          onPress={handleNext}
          style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}>
          <Text style={styles.nextText}>{isStepFour ? '시작하기' : '다음'}</Text>
        </Pressable>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  header: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ABB1B8',
  },
  activeDot: {
    backgroundColor: '#8656C2',
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 16,
    width: 24,
    height: 24,
  },
  closeIcon: {
    width: 24,
    height: 24,
  },
  content: {
    flex: 1,
  },
  page: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  guide: {
    width: 249,
    alignItems: 'center',
  },
  title: {
    color: '#111727',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 36.4,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 39,
  },
  visual: {
    width: 216,
    height: 343,
    position: 'relative',
  },
  screenClip: {
    width: 216,
    height: 343,
    borderRadius: 24,
    overflow: 'hidden',
  },
  screenImage: {
    width: 216,
    height: 456,
    borderRadius: 24,
  },
  stepTwoScreenImage: {
    position: 'absolute',
    top: -51,
    left: 0,
  },
  stepThreeScreenImage: {
    position: 'absolute',
    top: -347,
    left: 0,
    height: 1505,
  },
  stepFourScreenImage: {
    position: 'absolute',
    top: -14.5,
    left: 0,
    height: 751,
  },
  screenFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 216,
    height: 456,
  },
  highlight: {
    position: 'absolute',
    top: 83,
    left: -16.5,
    width: 249,
    height: 149,
    borderWidth: 3,
    borderColor: '#8656C2',
    borderRadius: 13,
    backgroundColor: '#D9D9D9',
    overflow: 'hidden',
    shadowColor: '#CACAD1',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 9.8,
    elevation: 6,
  },
  highlightImage: {
    position: 'absolute',
    top: -122,
    left: -12,
    width: 273,
    height: 577,
  },
  stepTwoHighlight: {
    top: 107,
    height: 76,
  },
  stepThreeHighlight: {
    top: 33,
    height: 92,
  },
  stepFourHighlight: {
    top: 33,
    height: 72,
  },
  stepTwoHighlightImage: {
    top: -372,
    left: -19,
    width: 353,
    height: 745,
  },
  stepThreeHighlightImage: {
    top: -504,
    left: -14.5,
    width: 291,
    height: 2027,
  },
  stepFourHighlightImage: {
    top: -67,
    left: -3.5,
    width: 339,
    height: 1179,
  },
  handBox: {
    position: 'absolute',
    top: 184,
    left: 148,
    width: 119.318,
    height: 119.318,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '22.32deg' }],
  },
  handImage: {
    width: 91.438,
    height: 91.438,
  },
  stepFourHandBox: {
    top: 70,
    left: 156,
  },
  footer: {
    width: '100%',
    paddingTop: 28,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  nextButton: {
    height: 50,
    borderWidth: 1,
    borderColor: '#8656C2',
    borderRadius: 10,
    backgroundColor: '#8656C2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  nextText: {
    color: '#F2F2F2',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
