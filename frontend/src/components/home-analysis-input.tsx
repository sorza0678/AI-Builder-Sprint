import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/constants/theme';

interface HomeAnalysisInputProps {
  inputError: string | null;
  isPasting: boolean;
  isPickingImage: boolean;
  disabled?: boolean;
  onPaste: () => void;
  onPickImage: () => void;
}

export function HomeAnalysisInput({
  inputError,
  isPasting,
  isPickingImage,
  disabled: externallyDisabled = false,
  onPaste,
  onPickImage,
}: HomeAnalysisInputProps) {
  const disabled = externallyDisabled || isPasting || isPickingImage;

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="매물 이미지 선택"
          disabled={disabled}
          hitSlop={4}
          onPress={onPickImage}
          style={({ pressed }) => [
            styles.imageButton,
            disabled && styles.disabled,
            pressed && styles.pressed,
          ]}>
          {isPickingImage ? (
            <ActivityIndicator color={colors.homeText} size="small" />
          ) : (
            <Image
              source={require('@/assets/images/home/image-picker.svg')}
              style={styles.imageIcon}
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
            disabled && styles.disabled,
            pressed && styles.pressed,
          ]}>
          {isPasting ? (
            <ActivityIndicator color={colors.homeText} size="small" />
          ) : (
            <Image
              source={require('@/assets/images/home/clipboard-paste.svg')}
              style={styles.pasteIcon}
              contentFit="fill"
            />
          )}
          <Text style={styles.pasteText}>붙여넣기</Text>
        </Pressable>
      </View>
      {inputError && <Text accessibilityRole="alert" style={styles.error}>{inputError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  imageButton: {
    width: 42,
    height: 42,
    padding: 11,
    borderRadius: 40,
    backgroundColor: colors.homeAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteButton: {
    height: 42,
    padding: 11,
    borderRadius: 40,
    backgroundColor: colors.homeAction,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageIcon: {
    width: 16.667,
    height: 16.667,
  },
  pasteIcon: {
    width: 15.833,
    height: 18.333,
  },
  pasteText: {
    color: colors.homeText,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: -0.3,
  },
  error: {
    maxWidth: 300,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.7,
  },
});
