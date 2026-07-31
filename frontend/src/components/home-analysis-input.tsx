import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/pretendard-text';
import { colors } from '@/src/constants/theme';

interface HomeAnalysisInputProps {
  scale?: number;
  inputError: string | null;
  isPasting: boolean;
  isPickingImage: boolean;
  disabled?: boolean;
  onPaste: () => void;
  onPickImage: () => void;
}

export function HomeAnalysisInput({
  scale = 1,
  inputError,
  isPasting,
  isPickingImage,
  disabled: externallyDisabled = false,
  onPaste,
  onPickImage,
}: HomeAnalysisInputProps) {
  const disabled = externallyDisabled || isPasting || isPickingImage;

  return (
    <View style={[styles.container, { gap: 8 * scale }]}>
      <View style={[styles.actions, { gap: 16 * scale }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="매물 이미지 선택"
          disabled={disabled}
          hitSlop={4}
          onPress={onPickImage}
          style={({ pressed }) => [
            styles.imageButton,
            {
              width: 42 * scale,
              height: 42 * scale,
              padding: 11 * scale,
              borderRadius: 40 * scale,
            },
            disabled && styles.disabled,
            pressed && styles.pressed,
          ]}>
          {isPickingImage ? (
            <ActivityIndicator color={colors.homeText} size="small" />
          ) : (
            <Image
              source={require('@/assets/images/home/image-picker.svg')}
              style={{ width: 16.667 * scale, height: 16.667 * scale }}
              contentFit="fill"
            />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="클립보드에서 링크 붙여넣기"
          disabled={disabled}
          hitSlop={4}
          onPress={onPaste}
          style={({ pressed }) => [
            styles.pasteButton,
            {
              height: 42 * scale,
              padding: 11 * scale,
              borderRadius: 40 * scale,
              gap: 8 * scale,
            },
            disabled && styles.disabled,
            pressed && styles.pressed,
          ]}>
          {isPasting ? (
            <ActivityIndicator color={colors.homeText} size="small" />
          ) : (
            <Image
              source={require('@/assets/images/home/clipboard-paste.svg')}
              style={{ width: 15.833 * scale, height: 18.333 * scale }}
              contentFit="fill"
            />
          )}
          <Text style={[styles.pasteText, {
            fontSize: 14 * scale,
            lineHeight: 14 * scale,
          }]}>붙여넣기</Text>
        </Pressable>
      </View>
      {inputError && (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { fontSize: 12 * scale, lineHeight: 16 * scale }]}>
          {inputError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageButton: {
    backgroundColor: colors.homeAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteButton: {
    backgroundColor: colors.homeAction,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pasteText: {
    color: colors.homeText,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  error: {
    maxWidth: 300,
    color: colors.danger,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.7,
  },
});
