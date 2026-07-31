import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeAnalysisInput } from '@/src/components/home-analysis-input';
import { HomeHeader } from '@/src/components/home-header';
import { HomeSidebar } from '@/src/components/home-sidebar';
import { colors } from '@/src/constants/theme';
import { getRecentListings } from '@/src/services/listing-service';
import { Listing } from '@/src/types/marketplace';
import { extractFirstHttpUrl } from '@/src/utils/url-validation';

export default function HomeScreen() {
  const [inputError, setInputError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [recent, setRecent] = useState<Listing[]>([]);
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

  const pasteUrl = async (): Promise<void> => {
    if (isPasting || isPickingImage) {
      return;
    }

    setIsPasting(true);
    setInputError(null);
    try {
      const clipboardUrl = extractFirstHttpUrl(await Clipboard.getStringAsync());
      if (!clipboardUrl) {
        setInputError('클립보드에서 올바른 링크를 찾지 못했어요.');
        return;
      }

      router.push({
        pathname: '/analysis-input',
        params: { url: clipboardUrl },
      });
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

      router.push({
        pathname: '/analysis-input',
        params: {
          imageUri: asset.uri,
          imageFileName: asset.fileName ?? '',
          imageMimeType: asset.mimeType ?? '',
          imageWidth: String(asset.width),
          imageHeight: String(asset.height),
        },
      });
    } catch {
      setInputError('이미지를 선택하지 못했습니다.');
      Alert.alert('이미지 선택 실패', '이미지를 선택하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsPickingImage(false);
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
