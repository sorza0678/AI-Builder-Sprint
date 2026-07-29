import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, AppTextInput, commonStyles } from '@/src/components/common';
import { colors, radius, spacing } from '@/src/constants/theme';
import { SelectedImage } from '@/src/types/analysis-input';

interface HomeAnalysisInputProps {
  url: string;
  selectedImage: SelectedImage | null;
  urlError: string | null;
  inputError: string | null;
  isPasting: boolean;
  isPickingImage: boolean;
  isSubmitting: boolean;
  canAnalyze: boolean;
  onUrlChange: (value: string) => void;
  onPaste: () => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onReset: () => void;
  onAnalyze: () => void;
  onImageLoadError: () => void;
}

export function HomeAnalysisInput({
  url,
  selectedImage,
  urlError,
  inputError,
  isPasting,
  isPickingImage,
  isSubmitting,
  canAnalyze,
  onUrlChange,
  onPaste,
  onPickImage,
  onRemoveImage,
  onReset,
  onAnalyze,
  onImageLoadError,
}: HomeAnalysisInputProps) {
  const hasInput = url.length > 0 || selectedImage !== null;

  return (
    <View style={styles.container}>
      <AppTextInput
        accessibilityLabel="매물 URL 입력"
        value={url}
        onChangeText={onUrlChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        placeholder="https://..."
        onSubmitEditing={canAnalyze ? onAnalyze : undefined}
      />
      {urlError && <Text style={styles.error}>{urlError}</Text>}

      <View style={commonStyles.row}>
        <View style={styles.flex}>
          <AppButton
            accessibilityLabel="클립보드에서 URL 붙여넣기"
            title={isPasting ? '붙여넣는 중...' : 'URL 붙여넣기'}
            variant="secondary"
            disabled={isPasting || isPickingImage || isSubmitting}
            onPress={onPaste}
          />
        </View>
        <View style={styles.flex}>
          <AppButton
            accessibilityLabel="매물 이미지 선택"
            title={isPickingImage ? '선택하는 중...' : '이미지 선택'}
            variant="secondary"
            disabled={isPasting || isPickingImage || isSubmitting}
            onPress={onPickImage}
          />
        </View>
      </View>

      {inputError && <Text style={styles.error}>{inputError}</Text>}

      {selectedImage ? (
        <View style={styles.previewContainer}>
          <Image
            accessibilityLabel="선택한 매물 이미지 미리보기"
            source={{ uri: selectedImage.uri }}
            style={styles.preview}
            onError={onImageLoadError}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="선택한 이미지 삭제"
            hitSlop={8}
            onPress={onRemoveImage}
            style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
            <Text style={styles.removeButtonText}>삭제</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={commonStyles.muted}>선택된 이미지 없음</Text>
        </View>
      )}

      {hasInput && (
        <AppButton
          accessibilityLabel="URL과 이미지 입력 초기화"
          title="입력 초기화"
          variant="secondary"
          disabled={isSubmitting}
          onPress={onReset}
        />
      )}
      <AppButton
        accessibilityLabel="매물 분석 시작"
        title={isSubmitting ? '분석 중...' : '분석 시작'}
        disabled={!canAnalyze}
        onPress={onAnalyze}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  flex: { flex: 1 },
  error: { color: colors.danger, fontSize: 13 },
  previewContainer: { position: 'relative' },
  preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md },
  removeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    minHeight: 44,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.overlay,
  },
  removeButtonText: { color: '#FFFFFF', fontWeight: '700' },
  placeholder: {
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  pressed: { opacity: 0.75 },
});
