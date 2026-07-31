import { HomeAnalysisInput } from "@/src/components/home-analysis-input";
import { HomeHeader } from "@/src/components/home-header";
import { HomeSidebar } from "@/src/components/home-sidebar";
import { Text } from "@/src/components/pretendard-text";
import { colors } from "@/src/constants/theme";
import { getRecentListings } from "@/src/services/listing-service";
import { Listing } from "@/src/types/marketplace";
import { extractFirstHttpUrl } from "@/src/utils/url-validation";
import MaskedView from "@react-native-masked-view/masked-view";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [inputError, setInputError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [recent, setRecent] = useState<Listing[]>([]);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const candidate = recent[0];
  const contentWidth = Math.min(width, 480);
  const usableHeight = height - insets.top;
  const scale = Math.min(contentWidth / 360, usableHeight / 736);
  const designWidth = 360 * scale;
  const headerHeight = 60 * scale;
  const headerGap = 58 * scale;
  const heroHeight = 238 * scale;
  const visualTopGap = 28 * scale;
  const visualTop = insets.top + headerHeight + headerGap + heroHeight + visualTopGap;
  const visualLeft = (width - designWidth) / 2;
  const visualHeight = Math.max(height - visualTop, 352 * scale);

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
          setInputError(
            "분석 준비 정보를 불러오지 못했습니다. 다시 시도해 주세요.",
          );
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
      const clipboardUrl = extractFirstHttpUrl(
        await Clipboard.getStringAsync(),
      );
      if (!clipboardUrl) {
        setInputError("클립보드에서 올바른 링크를 찾지 못했어요.");
        return;
      }

      router.push({
        pathname: "/analysis-input",
        params: { url: clipboardUrl },
      });
    } catch {
      setInputError("클립보드 내용을 가져오지 못했습니다.");
      Alert.alert(
        "붙여넣기 실패",
        "클립보드 내용을 가져오지 못했습니다. 다시 시도해 주세요.",
      );
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
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setInputError("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        throw new Error("Selected image is missing");
      }

      router.push({
        pathname: "/analysis-input",
        params: {
          imageUri: asset.uri,
          imageFileName: asset.fileName ?? "",
          imageMimeType: asset.mimeType ?? "",
          imageWidth: String(asset.width),
          imageHeight: String(asset.height),
        },
      });
    } catch {
      setInputError("이미지를 선택하지 못했습니다.");
      Alert.alert(
        "이미지 선택 실패",
        "이미지를 선택하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleMenuPress = (): void => {
    setSidebarVisible(true);
  };

  const handleHeaderActionPress = (): void => {
    router.push("/compare");
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[
          colors.homeGradientTop,
          colors.homeGradientTop,
          colors.homeGradientBottom,
        ]}
        locations={[0, 0.69234, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require("@/assets/images/home/background-texture.jpg")}
        style={styles.texture}
        contentFit="cover"
        pointerEvents="none"
      />

      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={[styles.content, { width: designWidth }]}>
          <HomeHeader
            scale={scale}
            onMenuPress={handleMenuPress}
            onActionPress={handleHeaderActionPress}
          />

          <View
            style={[
              styles.hero,
              {
                height: 238 * scale,
                marginTop: 58 * scale,
                paddingHorizontal: 16 * scale,
                paddingVertical: 35 * scale,
                gap: 40 * scale,
              },
            ]}
          >
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="링크를 입력해 상품을 분석해볼까요?"
              onPress={() => router.push("/analysis-input")}
              style={styles.titleGroup}
            >
              <MaskedView
                style={[styles.primaryTitleMask, { height: 41.6 * scale }]}
                maskElement={
                  <Text
                    style={[
                      styles.primaryTitleText,
                      { fontSize: 32 * scale, lineHeight: 41.6 * scale },
                    ]}
                  >
                    링크를 입력해
                  </Text>
                }
              >
                <LinearGradient
                  colors={[colors.homeTitleStart, colors.homeTitleEnd]}
                  locations={[0.13095, 0.83333]}
                  style={styles.titleGradient}
                />
              </MaskedView>
              <Text
                style={[
                  styles.secondaryTitleText,
                  { fontSize: 32 * scale, lineHeight: 41.6 * scale },
                ]}
              >
                상품을 분석해볼까요?
              </Text>
            </Pressable>
            <HomeAnalysisInput
              scale={scale}
              inputError={inputError}
              isPasting={isPasting}
              isPickingImage={isPickingImage}
              disabled={!candidate}
              onPaste={pasteUrl}
              onPickImage={pickImage}
            />
          </View>
        </View>
      </SafeAreaView>

      <View
        pointerEvents="none"
        style={[
          styles.productVisual,
          {
            width: designWidth,
            height: visualHeight,
            left: visualLeft,
            top: visualTop,
          },
        ]}
      >
        <Image
          source={require("@/assets/images/home/calculator.png")}
          style={{
            position: "absolute",
            width: 471.209 * scale,
            height: 706.814 * scale,
            left: -53.6 * scale,
            top: -88 * scale,
          }}
          contentFit="cover"
        />
      </View>

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
    opacity: 0.83,
    mixBlendMode: "overlay",
  },
  safeArea: {
    flex: 1,
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  hero: {
    alignItems: "center",
    justifyContent: "center",
  },
  titleGroup: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryTitleMask: {
    width: "100%",
  },
  primaryTitleText: {
    color: "#000000",
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  secondaryTitleText: {
    color: colors.homeTitleAccent,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  titleGradient: {
    flex: 1,
  },
  productVisual: {
    overflow: "hidden",
    position: "absolute",
  },
});
