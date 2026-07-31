import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/src/components/pretendard-text';

import { Listing } from '@/src/types/marketplace';

type EditableField =
  | 'title'
  | 'modelName'
  | 'year'
  | 'sizeOrCapacity'
  | 'color'
  | 'price'
  | 'components'
  | 'usagePeriod'
  | 'defects';

const fields: { key: EditableField; label: string; needsReview?: boolean }[] = [
  { key: 'title', label: '상품명' },
  { key: 'modelName', label: '모델명' },
  { key: 'year', label: '연식', needsReview: true },
  { key: 'sizeOrCapacity', label: '사이즈' },
  { key: 'color', label: '색상' },
  { key: 'price', label: '판매가' },
  { key: 'components', label: '구성품', needsReview: true },
  { key: 'usagePeriod', label: '사용 기간' },
  { key: 'defects', label: '판매자 고지 하자' },
];

const arrowIcon = require('@/assets/images/analysis-input/arrow-left.svg');
const infoIcon = require('@/assets/images/analysis-confirm/info.svg');
const checkIcon = require('@/assets/images/analysis-confirm/check.svg');
const editHandle = require('@/assets/images/analysis-confirm/edit-handle.svg');
const editInfoIcon = require('@/assets/images/analysis-confirm/edit-info.svg');

interface AnalysisConfirmSheetProps {
  visible: boolean;
  listing: Listing;
  isAnalyzing?: boolean;
  onClose: () => void;
  onAnalyze: (listing: Listing) => void;
}

export function AnalysisConfirmSheet({
  visible,
  listing,
  isAnalyzing = false,
  onClose,
  onAnalyze,
}: AnalysisConfirmSheetProps) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [draft, setDraft] = useState(listing);
  const editorProgress = useRef(new Animated.Value(0)).current;
  const editorInputRef = useRef<TextInput>(null);

  useEffect(() => {
    setDraft(listing);
    setEditingField(null);
    setEditingValue('');
  }, [listing, visible]);

  useEffect(() => {
    if (!editingField) {
      return;
    }

    editorProgress.setValue(0);
    Animated.timing(editorProgress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        editorInputRef.current?.focus();
      }
    });
  }, [editingField, editorProgress]);

  const valueFor = (field: EditableField): string => {
    const value = draft[field];
    if (field === 'price') {
      return draft.price.toLocaleString('ko-KR');
    }
    return Array.isArray(value) ? value.join(', ') : String(value ?? '');
  };

  const update = (field: EditableField, value: string): void => {
    if (field === 'price') {
      setDraft((current) => ({
        ...current,
        price: Number(value.replace(/\D/g, '')) || 0,
      }));
      return;
    }

    if (field === 'components' || field === 'defects') {
      setDraft((current) => ({
        ...current,
        [field]: value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }));
      return;
    }

    setDraft((current) => ({ ...current, [field]: value }));
  };

  const openEditor = (field: EditableField): void => {
    setEditingValue(valueFor(field));
    setEditingField(field);
  };

  const closeEditor = (): void => {
    editorInputRef.current?.blur();
    Animated.timing(editorProgress, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setEditingField(null);
        setEditingValue('');
      }
    });
  };

  const saveEditor = (): void => {
    if (!editingField) {
      return;
    }
    update(editingField, editingValue);
    closeEditor();
  };

  const editingLabel = editingField
    ? fields.find(({ key }) => key === editingField)?.label
    : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="분석 입력 화면으로 돌아가기"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Image source={arrowIcon} style={styles.backIcon} contentFit="contain" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.intro}>
              <Text style={styles.title}>
                AI가 먼저 정리했어요.{'\n'}
                <Text style={styles.titleAccent}>다른 부분만 수정</Text>해주세요.
              </Text>

              <View style={styles.notice}>
                <Image source={infoIcon} style={styles.infoIcon} contentFit="contain" />
                <Text style={styles.noticeText}>
                  <Text style={styles.noticeEmphasis}>연식, 구성품</Text>은 정확하지 않을 수 있어요.{'\n'}
                  한 번 확인해주세요.
                </Text>
              </View>
            </View>

            <View style={styles.cardList}>
              {fields.map(({ key, label, needsReview }) => {
                return (
                  <View
                    key={key}
                    style={[styles.card, needsReview && styles.reviewCard]}
                  >
                    <View style={[styles.checkCircle, needsReview && styles.reviewCheckCircle]}>
                      <Image source={checkIcon} style={styles.checkIcon} contentFit="contain" />
                    </View>

                    <View style={styles.fieldContent}>
                      <Text style={styles.label}>{label}</Text>
                      <Text
                        numberOfLines={2}
                        style={[styles.value, needsReview && styles.reviewValue]}
                      >
                        {key === 'price'
                          ? `${draft.price.toLocaleString('ko-KR')}원`
                          : valueFor(key) || '정보 없음'}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityLabel={`${label} 수정`}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => openEditor(key)}
                      style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.editText}>수정</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <LinearGradient
            colors={['rgba(255,255,255,0)', '#FFFFFF', '#FFFFFF']}
            locations={[0, 0.2, 1]}
            pointerEvents="box-none"
            style={styles.actionGradient}
          >
            <Pressable
              accessibilityRole="button"
              disabled={isAnalyzing}
              onPress={() => onAnalyze(draft)}
              style={({ pressed }) => [
                styles.analyzeButton,
                isAnalyzing && styles.disabledButton,
                pressed && !isAnalyzing && styles.pressed,
              ]}
            >
              <Text style={styles.analyzeButtonText}>
                {isAnalyzing ? '분석 중...' : '확인 후 분석 시작 →'}
              </Text>
            </Pressable>
          </LinearGradient>

          {editingField && editingLabel ? (
            <View style={styles.editorOverlay}>
              <Animated.View
                pointerEvents="none"
                style={[styles.editorBackdrop, { opacity: editorProgress }]}
              />
              <Pressable
                accessibilityLabel="수정 취소"
                onPress={closeEditor}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View
                style={[
                  styles.editorSheet,
                  {
                    transform: [
                      {
                        translateY: editorProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [360, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Image source={editHandle} style={styles.editHandle} contentFit="contain" />

                <View style={styles.editorBody}>
                  <View style={styles.editorField}>
                    <Text style={styles.editorLabel}>{editingLabel}</Text>
                    <TextInput
                      ref={editorInputRef}
                      keyboardType={editingField === 'price' ? 'number-pad' : 'default'}
                      onChangeText={setEditingValue}
                      onSubmitEditing={saveEditor}
                      returnKeyType="done"
                      selectionColor="#8656C2"
                      style={styles.editorInput}
                      value={editingValue}
                    />
                  </View>

                  <View style={styles.editorNotice}>
                    <Image source={editInfoIcon} style={styles.editorInfoIcon} contentFit="contain" />
                    <Text style={styles.editorNoticeText}>
                      AI가 읽은 내용이에요. 필요한 부분만 수정해주세요.
                    </Text>
                  </View>
                </View>

                <View style={styles.editorAction}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={saveEditor}
                    style={({ pressed }) => [
                      styles.editorSaveButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.editorSaveText}>저장하기</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#F0F0FA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 106,
  },
  intro: {
    gap: 24,
    paddingHorizontal: 10,
    marginBottom: 32,
  },
  title: {
    color: '#111727',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32.4,
    letterSpacing: -0.3,
  },
  titleAccent: {
    color: '#8656C2',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  infoIcon: {
    width: 21,
    height: 21,
  },
  noticeText: {
    flex: 1,
    color: '#484B4D',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19.6,
    letterSpacing: -0.3,
  },
  noticeEmphasis: {
    color: '#111727',
    textDecorationLine: 'underline',
  },
  cardList: {
    gap: 10,
  },
  card: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderColor: '#F0F0F0',
    borderRadius: 20,
    borderWidth: 1,
  },
  reviewCard: {
    backgroundColor: '#F3EFF9',
  },
  checkCircle: {
    width: 33,
    height: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#A597CC',
  },
  reviewCheckCircle: {
    backgroundColor: '#8656C2',
  },
  checkIcon: {
    width: 21,
    height: 16,
  },
  fieldContent: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    paddingVertical: 12,
  },
  label: {
    color: '#797979',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 15,
    letterSpacing: -0.3,
  },
  value: {
    color: '#838C97',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
    letterSpacing: -0.3,
  },
  reviewValue: {
    color: '#424242',
  },
  editButton: {
    alignSelf: 'flex-start',
    minWidth: 34,
    minHeight: 34,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  editText: {
    color: '#797979',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 15,
    letterSpacing: -0.3,
  },
  actionGradient: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingTop: 28,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  editorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  editorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(33,33,33,0.6)',
  },
  editorSheet: {
    overflow: 'hidden',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  editHandle: {
    alignSelf: 'center',
    width: 154,
    height: 31,
  },
  editorBody: {
    gap: 20,
  },
  editorField: {
    gap: 10,
  },
  editorLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    color: '#424242',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  editorInput: {
    width: '100%',
    height: 52,
    paddingHorizontal: 16,
    paddingVertical: 0,
    color: '#212121',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'Pretendard-Regular',
    lineHeight: 20,
    letterSpacing: -0.3,
    backgroundColor: '#FFFFFF',
    borderColor: '#8656C2',
    borderRadius: 12,
    borderWidth: 1,
  },
  editorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editorInfoIcon: {
    width: 16,
    height: 16,
  },
  editorNoticeText: {
    flex: 1,
    color: '#9098A2',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  editorAction: {
    marginHorizontal: -16,
    padding: 16,
  },
  editorSaveButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: '#8656C2',
    borderColor: '#8656C2',
    borderRadius: 10,
    borderWidth: 1,
  },
  editorSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  analyzeButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: '#8656C2',
    borderColor: '#8656C2',
    borderRadius: 10,
    borderWidth: 1,
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.72,
  },
});
