import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisConfirmSheet } from '@/src/components/analysis-confirm-sheet';
import { HomeAnalysisInput } from '@/src/components/home-analysis-input';
import { HomeHeader } from '@/src/components/home-header';
import { HomeSidebar } from '@/src/components/home-sidebar';
import { colors } from '@/src/constants/theme';
import { createMockAnalysis } from '@/src/services/analysis-service';
import { getRecentListings } from '@/src/services/listing-service';
import { AnalysisDraft, SelectedImage } from '@/src/types/analysis-input';
import { Listing } from '@/src/types/marketplace';
import { getUrlError, normalizeUrl } from '@/src/utils/url-validation';

export default function HomeScreen() {
  const [inputError, setInputError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recent, setRecent] = useState<Listing[]>([]);
  const [pendingInput, setPendingInput] = useState<AnalysisDraft | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const candidate = recent[0];

  useEffect(() => {
    let active = true;
    getRecentListings()
      .then((items) => {
        if (active) {
          setRecent(items);
        }
      })
      .catch(() => {
        if (active) {
          setInputError('분석 준비 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const draftListing = useMemo(() => {
    if (!candidate || !pendingInput) {
      return undefined;
    }
    return {
      ...candidate,
      sourceUrl: pendingInput.url || candidate.sourceUrl,
      imageUrl: pendingInput.image?.uri ?? candidate.imageUrl,
    };
  }, [candidate, pendingInput]);

  const openConfirmation = (input: AnalysisDraft): void => {
    if (!candidate) {
      setInputError('분석 준비 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setPendingInput(input);
    setInputError(null);
    setSheetVisible(true);
  };

  const pasteUrl = async (): Promise<void> => {
    if (isPasting || isPickingImage) {
      return;
    }

    setIsPasting(true);
    setInputError(null);
    try {
      const clipboardText = normalizeUrl(await Clipboard.getStringAsync());
      if (clipboardText.length === 0) {
        setInputError('클립보드에 붙여넣을 링크가 없어요.');
        return;
      }

      const urlError = getUrlError(clipboardText);
      if (urlError) {
        setInputError(urlError);
        return;
      }

      openConfirmation({ url: clipboardText, image: null });
    } catch {
      setInputError('클립보드 내용을 가져오지 못했습니다.');
      Alert.alert('붙여넣기 실패', '클립보드 내용을 가져오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsPasting(false);
    }
  };

  const pickImage = async (): Promise<void> => {
    if (isPickingImage || isPasting) {
      return;
    }

    setIsPickingImage(true);
    setInputError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setInputError('이미지를 선택하려면 사진 접근 권한이 필요합니다.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        throw new Error('Selected image is missing');
      }

      const selectedImage: SelectedImage = {
        uri: asset.uri,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
        width: asset.width,
        height: asset.height,
      };
      openConfirmation({ url: '', image: selectedImage });
    } catch {
      setInputError('이미지를 선택하지 못했습니다.');
      Alert.alert('이미지 선택 실패', '이미지를 선택하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const submitAnalysis = async (listing: Listing): Promise<void> => {
    if (!pendingInput || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setInputError(null);
    try {
      // TODO: 백엔드 분석 API 연결 시 pendingInput과 확인된 listing 정보를 전송하도록 교체
      const result = await createMockAnalysis(listing);
      setSheetVisible(false);
      router.push(`/analysis/${result.id}`);
    } catch {
      setInputError('분석을 시작하지 못했습니다.');
      Alert.alert('분석 요청 실패', '분석을 시작하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMenuPress = (): void => {
    setSidebarVisible(true);
  };

  const handleHeaderActionPress = (): void => {
    // TODO: 우측 헤더 아이콘의 기능 명세가 확정되면 연결
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.homeGradientTop, colors.homeGradientTop, colors.homeGradientBottom]}
        locations={[0, 0.69234, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require('@/assets/images/home/background-texture.jpg')}
        style={styles.texture}
        contentFit="cover"
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea}>
        <HomeHeader
          onMenuPress={handleMenuPress}
          onActionPress={handleHeaderActionPress}
        />

        <View style={styles.hero}>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel="링크를 입력해 상품을 분석해볼까요?"
            style={styles.titleGroup}>
            <MaskedView
              style={styles.titleMask}
              maskElement={
                <View style={styles.titleMaskContent}>
                  <Text style={styles.titleText}>링크를 입력해</Text>
                  <Text style={styles.titleText}>상품을 분석해볼까요?</Text>
                </View>
              }>
              <LinearGradient
                colors={[
                  colors.homeTitleStart,
                  colors.homeTitleEnd,
                  colors.homeTitleAccent,
                ]}
                locations={[0, 0.45, 1]}
                style={styles.titleGradient}
              />
            </MaskedView>
          </View>
          <HomeAnalysisInput
            inputError={inputError}
            isPasting={isPasting}
            isPickingImage={isPickingImage}
            disabled={!candidate}
            onPaste={pasteUrl}
            onPickImage={pickImage}
          />
        </View>

        <View style={styles.productVisual} />
      </SafeAreaView>

      {draftListing && (
        <AnalysisConfirmSheet
          visible={sheetVisible}
          listing={draftListing}
          isAnalyzing={isSubmitting}
          onClose={() => setSheetVisible(false)}
          onAnalyze={submitAnalysis}
        />
      )}
      <HomeSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.homeGradientTop,
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
  },
  safeArea: {
    flex: 1,
  },
  hero: {
    height: 238,
    marginTop: 58,
    paddingHorizontal: 16,
    paddingVertical: 35,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  titleGroup: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleMask: {
    width: '100%',
    height: 83.2,
  },
  titleMaskContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    color: '#000000',
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 41.6,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  titleGradient: {
    flex: 1,
  },
  productVisual: {
    flex: 1,
    minHeight: 260,
    marginTop: 28,
    overflow: 'hidden',
    position: 'relative',
  },
});
