import { useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { AnalysisConfirmSheet } from '@/src/components/analysis-confirm-sheet';
import { AppButton, commonStyles, ListingCard, ScreenContainer, SectionHeader } from '@/src/components/common';
import { HomeAnalysisInput } from '@/src/components/home-analysis-input';
import { createMockAnalysis } from '@/src/services/analysis-service';
import { getRecentListings, getSavedListings } from '@/src/services/listing-service';
import { AnalysisDraft, SelectedImage } from '@/src/types/analysis-input';
import { Listing } from '@/src/types/marketplace';
import { canSubmitAnalysisDraft, resetAnalysisDraft } from '@/src/utils/analysis-draft';
import { getUrlError, normalizeUrl } from '@/src/utils/url-validation';

export default function HomeScreen() {
  // 사용자가 작성 중인 분석 입력과 입력 관련 오류 상태입니다.
  const [url, setUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 서비스 계층에서 가져온 Mock 목록과 분석 확인 화면 상태입니다.
  const [recent, setRecent] = useState<Listing[]>([]);
  const [saved, setSaved] = useState<Listing[]>([]);
  const [pendingInput, setPendingInput] = useState<AnalysisDraft | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const candidate = recent[0];
  const normalizedUrl = normalizeUrl(url);
  const canAnalyze = canSubmitAnalysisDraft(
    { url: normalizedUrl, image: selectedImage },
    isSubmitting,
  );

  useEffect(() => {
    // 화면은 Mock 파일을 직접 참조하지 않고 서비스 함수를 통해 목록을 조회합니다.
    let active = true;
    Promise.all([getRecentListings(), getSavedListings()])
      .then(([recentItems, savedItems]) => {
        if (active) {
          setRecent(recentItems);
          setSaved(savedItems);
        }
      })
      .catch(() => {
        if (active) {
          setInputError('매물 목록을 불러오지 못했습니다. 다시 시도해 주세요.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const draftListing = useMemo(() => {
    // 분석 전 확인 화면에 보여줄 임시 매물 정보를 입력값과 결합합니다.
    if (!candidate || !pendingInput) {
      return undefined;
    }
    return {
      ...candidate,
      sourceUrl: normalizeUrl(pendingInput.url) || candidate.sourceUrl,
      imageUrl: pendingInput.image?.uri ?? candidate.imageUrl,
    };
  }, [candidate, pendingInput]);

  const changeUrl = (value: string): void => {
    // URL 입력이 바뀔 때 정규화와 검증 결과를 즉시 갱신합니다.
    const normalizedValue = normalizeUrl(value);
    setUrl(normalizedValue);
    setUrlError(getUrlError(normalizedValue));
    setInputError(null);
  };

  const pasteUrl = async (): Promise<void> => {
    // 처리 중 재호출을 막아 클립보드 작업이 중복 실행되지 않게 합니다.
    if (isPasting) {
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
      setUrl(clipboardText);
      setUrlError(getUrlError(clipboardText));
    } catch {
      setInputError('클립보드 내용을 가져오지 못했습니다.');
      Alert.alert('붙여넣기 실패', '클립보드 내용을 가져오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsPasting(false);
    }
  };

  const pickImage = async (): Promise<void> => {
    // 사진 권한을 확인하고 한 장의 이미지 정보만 입력 상태에 저장합니다.
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

      setSelectedImage({
        uri: asset.uri,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
        width: asset.width,
        height: asset.height,
      });
      setInputError(null);
    } catch {
      setInputError('이미지를 선택하지 못했습니다.');
      Alert.alert('이미지 선택 실패', '이미지를 선택하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const removeImage = (): void => {
    setSelectedImage(null);
    setInputError(null);
  };

  const resetInput = (): void => {
    // 입력값과 입력 과정에서 발생한 오류·진행 상태를 모두 초기화합니다.
    const emptyDraft = resetAnalysisDraft();
    setUrl(emptyDraft.url);
    setSelectedImage(emptyDraft.image);
    setUrlError(null);
    setInputError(null);
    setIsPasting(false);
    setIsPickingImage(false);
    setIsSubmitting(false);
    setPendingInput(null);
    setSheetVisible(false);
  };

  const prepareAnalysis = (): void => {
    // 제출 직전에 다시 검증한 뒤 백엔드 DTO가 아닌 화면용 초안을 만듭니다.
    const finalUrl = normalizeUrl(url);
    const finalUrlError = getUrlError(finalUrl);
    setUrl(finalUrl);
    setUrlError(finalUrlError);
    setInputError(null);

    if (finalUrlError) {
      return;
    }
    if (finalUrl.length === 0 && selectedImage === null) {
      setInputError('URL 또는 이미지를 하나 이상 입력해 주세요.');
      return;
    }
    if (!candidate) {
      setInputError('분석 준비 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    const input: AnalysisDraft = {
      url: finalUrl,
      image: selectedImage,
    };
    setPendingInput(input);
    setSheetVisible(true);
  };

  const submitAnalysis = async (listing: Listing): Promise<void> => {
    // 현재는 확인된 매물로 Mock 결과를 만들고 결과 라우트로 이동합니다.
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

  return (
    <ScreenContainer>
      <Text style={commonStyles.title}>매물 분석</Text>
      <Text style={commonStyles.subtitle}>URL 또는 매물 이미지를 입력해 분석을 시작하세요.</Text>
      <HomeAnalysisInput
        url={url}
        selectedImage={selectedImage}
        urlError={urlError}
        inputError={inputError}
        isPasting={isPasting}
        isPickingImage={isPickingImage}
        isSubmitting={isSubmitting}
        canAnalyze={canAnalyze}
        onUrlChange={changeUrl}
        onPaste={pasteUrl}
        onPickImage={pickImage}
        onRemoveImage={removeImage}
        onReset={resetInput}
        onAnalyze={prepareAnalysis}
        onImageLoadError={() => setInputError('이미지를 불러오지 못했습니다. 다시 선택해 주세요.')}
      />
      <SectionHeader title="최근 분석" />
      {recent.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
      <SectionHeader title="저장한 매물" />
      {saved.slice(0, 2).map((listing) => <ListingCard key={listing.id} listing={listing} />)}
      <AppButton title="마이페이지" variant="secondary" onPress={() => router.push('/mypage')} />
      {draftListing && (
        <AnalysisConfirmSheet
          visible={sheetVisible}
          listing={draftListing}
          isAnalyzing={isSubmitting}
          onClose={() => setSheetVisible(false)}
          onAnalyze={submitAnalysis}
        />
      )}
    </ScreenContainer>
  );
}
