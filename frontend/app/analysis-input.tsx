import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisConfirmSheet } from '@/src/components/analysis-confirm-sheet';
import { Text } from '@/src/components/pretendard-text';
import { colors } from '@/src/constants/theme';
import { createAnalysis, deleteAnalysis } from '@/src/services/analysis-service';
import { ApiError } from '@/src/services/api-client';
import { saveListingDetails } from '@/src/services/listing-service';
import { cacheAnalysisResult } from '@/src/repositories/analysis-result-cache-repository';
import { AnalysisDraft, SelectedImage } from '@/src/types/analysis-input';
import { AnalysisResult, Listing } from '@/src/types/marketplace';
import { extractFirstHttpUrl, getUrlError, normalizeUrl } from '@/src/utils/url-validation';

export default function AnalysisInputScreen() {
  const params = useLocalSearchParams<{
    url?: string | string[];
    imageUri?: string | string[];
    imageFileName?: string | string[];
    imageMimeType?: string | string[];
    imageWidth?: string | string[];
    imageHeight?: string | string[];
  }>();
  const getFirstParam = (value?: string | string[]): string =>
    Array.isArray(value) ? value[0] ?? '' : value ?? '';
  const initialUrl = normalizeUrl(Array.isArray(params.url) ? params.url[0] ?? '' : params.url ?? '');
  const initialImageUri = getFirstParam(params.imageUri);
  const inputRef = useRef<TextInput>(null);
  const [url, setUrl] = useState(initialUrl);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(() =>
    initialImageUri
      ? {
          uri: initialImageUri,
          fileName: getFirstParam(params.imageFileName) || undefined,
          mimeType: getFirstParam(params.imageMimeType) || undefined,
          width: Number(getFirstParam(params.imageWidth)) || undefined,
          height: Number(getFirstParam(params.imageHeight)) || undefined,
        }
      : null
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingInput, setPendingInput] = useState<AnalysisDraft | null>(null);
  const [pendingResult, setPendingResult] = useState<AnalysisResult>();
  const [sheetVisible, setSheetVisible] = useState(false);

  const draftListing = useMemo(() => {
    if (!pendingResult) {
      return undefined;
    }
    return pendingResult.listing;
  }, [pendingResult]);

  const openConfirmation = async (input: AnalysisDraft): Promise<void> => {
    if (isSubmitting) return;
    if (pendingResult?.listing.sourceUrl === input.url) {
      setPendingInput(input);
      setSheetVisible(true);
      return;
    }
    setPendingInput(input);
    setInputError(null);
    setIsSubmitting(true);
    try {
      const requestListing: Listing = {
        id: 'pending', title: '', platform: '', sourceUrl: input.url,
        imageUrl: input.image?.uri ?? null, price: 0, modelName: '', year: '',
        sizeOrCapacity: '', color: '', usagePeriod: '', components: [], defects: [],
        sellerDescription: '', saved: false,
      };
      const result = await createAnalysis(requestListing);
      setPendingResult(result);
      setSheetVisible(true);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '분석을 시작하지 못했습니다.';
      setInputError(message);
      Alert.alert('분석 요청 실패', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmUrl = (): void => {
    const normalizedUrl = normalizeUrl(url);
    const urlError = getUrlError(normalizedUrl);
    setUrl(normalizedUrl);
    setInputError(urlError);
    if (urlError || normalizedUrl.length === 0) {
      return;
    }
    void openConfirmation({ url: normalizedUrl, image: null });
  };

  const confirmInput = (): void => {
    Keyboard.dismiss();
    const normalizedUrl = normalizeUrl(url);
    const urlError = normalizedUrl ? getUrlError(normalizedUrl) : null;
    setUrl(normalizedUrl);
    setInputError(urlError);
    if (urlError) {
      return;
    }

    if (selectedImage && !normalizedUrl) {
      setInputError('이미지 분석은 아직 서버에서 지원하지 않습니다. 매물 URL을 함께 입력해 주세요.');
      return;
    }
    if (selectedImage) {
      void openConfirmation({ url: normalizedUrl, image: selectedImage });
      return;
    }
    confirmUrl();
  };

  const pickImage = async (): Promise<void> => {
    if (isPickingImage) {
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
      setSelectedImage(selectedImage);
      setPendingResult(undefined);
    } catch {
      setInputError('이미지를 선택하지 못했습니다.');
      Alert.alert('이미지 선택 실패', '이미지를 선택하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const submitAnalysis = async (listing: Listing): Promise<void> => {
    if (!pendingInput || !pendingResult || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await saveListingDetails(listing);
      const result = { ...pendingResult, listing };
      await cacheAnalysisResult(result);
      setSheetVisible(false);
      router.replace(`/analysis/${result.id}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '분석을 시작하지 못했습니다.';
      setInputError(message);
      Alert.alert('분석 요청 실패', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const discardPendingAnalysis = async (): Promise<void> => {
    if (isSubmitting) return;
    const result = pendingResult;
    if (!result) {
      setSheetVisible(false);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteAnalysis(result.id);
      setPendingResult((current) => current?.id === result.id ? undefined : current);
      setPendingInput(null);
      setSheetVisible(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch {
      Alert.alert('기록 정리 실패', '임시 분석 기록을 삭제하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            hitSlop={10}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Image
              source={require('@/assets/images/analysis-input/arrow-left.svg')}
              style={styles.backIcon}
              contentFit="fill"
            />
          </Pressable>
          <View style={styles.headerSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="입력 완료"
            accessibilityState={{ disabled: isSubmitting || (!selectedImage && url.length === 0) }}
            disabled={isSubmitting || (!selectedImage && url.length === 0)}
            hitSlop={10}
            onPress={confirmInput}
            style={({ pressed }) => [styles.headerActionBox, pressed && styles.pressed]}>
            <Text
              style={[
                styles.headerActionText,
                (isSubmitting || (!selectedImage && url.length === 0)) && styles.headerActionTextDisabled,
              ]}>
              {isSubmitting ? '분석 중...' : '완료'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.inputSection}>
          <TextInput
            ref={inputRef}
            accessibilityLabel="분석할 상품 링크"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={!selectedImage}
            keyboardType="url"
            disableFullscreenUI
            onChangeText={(value) => {
              setUrl(extractFirstHttpUrl(value) ?? value);
              setPendingResult(undefined);
              setInputError(null);
            }}
            onSubmitEditing={confirmInput}
            placeholder="분석할 상품의 링크를 입력하세요"
            placeholderTextColor="#CDCDCD"
            returnKeyType="done"
            selectionColor="#8656C2"
            style={styles.input}
            underlineColorAndroid="transparent"
            value={url}
          />
          {selectedImage && (
            <View style={styles.previewFrame}>
              <View style={styles.previewImageBox}>
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.previewImage}
                  contentFit="cover"
                  transition={0}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="선택한 이미지 삭제"
                  hitSlop={4}
                  onPress={() => {
                    setSelectedImage(null);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  style={({ pressed }) => [
                    styles.removeImageButton,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.removeImageCircle}>
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
            </View>
          )}
          {inputError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {inputError}
            </Text>
          )}
        </View>

        <View style={styles.flexibleArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="상품 이미지 선택"
            disabled={isPickingImage}
            onPress={pickImage}
            style={({ pressed }) => [
              styles.imageButton,
              isPickingImage && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <View style={styles.imageIconBox}>
              <Image
                source={require('@/assets/images/analysis-input/image-picker.svg')}
                style={styles.imageIcon}
                contentFit="fill"
              />
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {isSubmitting && !sheetVisible ? (
        <View accessibilityRole="progressbar" style={styles.analysisLoadingOverlay}>
          <View style={styles.analysisLoadingCard}>
            <ActivityIndicator color="#8656C2" size="large" />
            <Text style={styles.analysisLoadingTitle}>매물 정보를 분석하고 있어요</Text>
            <Text style={styles.analysisLoadingDescription}>
              상품 정보와 시세, 위험 신호를 확인하는 중입니다.
            </Text>
          </View>
        </View>
      ) : null}

      {draftListing && (
        <AnalysisConfirmSheet
          visible={sheetVisible}
          listing={draftListing}
          isAnalyzing={isSubmitting}
          onClose={() => void discardPendingAnalysis()}
          onAnalyze={submitAnalysis}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  root: {
    flex: 1,
  },
  analysisLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(17, 23, 39, 0.42)',
    zIndex: 20,
  },
  analysisLoadingCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  analysisLoadingTitle: {
    marginTop: 4,
    color: '#111727',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  analysisLoadingDescription: {
    color: '#838C97',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 16,
    height: 16,
  },
  headerSpacer: {
    flex: 1,
  },
  headerActionBox: {
    minWidth: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    color: '#8656C2',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  headerActionTextDisabled: {
    color: '#D2D2E2',
  },
  inputSection: {
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0FA',
    alignItems: 'flex-start',
  },
  input: {
    height: 73,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: '#424242',
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    includeFontPadding: false,
    lineHeight: 20,
    letterSpacing: -0.3,
    textAlignVertical: 'center',
  },
  previewFrame: {
    width: 156,
    height: 156,
    marginBottom: 9,
    padding: 4,
    borderWidth: 1,
    borderColor: '#EDEDED',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  previewImageBox: {
    width: 146,
    height: 146,
    borderRadius: 20,
    overflow: 'hidden',
  },
  previewImage: {
    width: 146,
    height: 146,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  removeImageButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(33, 33, 33, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginTop: 8,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  flexibleArea: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  imageButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: '#DBDBDB',
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#212121',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imageIconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageIcon: {
    width: 17.7,
    height: 17.7,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.65,
  },
});
