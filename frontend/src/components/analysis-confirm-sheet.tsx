import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton, AppTextInput, commonStyles } from './common';
import { Listing } from '@/src/types/marketplace';
import { colors, radius, spacing } from '@/src/constants/theme';

type EditableField = 'title' | 'modelName' | 'year' | 'sizeOrCapacity' | 'color' | 'price' | 'components' | 'usagePeriod' | 'defects';
const labels: Record<EditableField, string> = {
  title: '상품명', modelName: '모델명', year: '연식', sizeOrCapacity: '용량/사이즈',
  color: '색상', price: '판매가', components: '구성품', usagePeriod: '사용 기간', defects: '판매자가 밝힌 하자',
};

export function AnalysisConfirmSheet({ visible, listing, isAnalyzing = false, onClose, onAnalyze }: {
  visible: boolean; listing: Listing; isAnalyzing?: boolean; onClose: () => void; onAnalyze: (listing: Listing) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(listing);
  useEffect(() => setDraft(listing), [listing]);

  const valueFor = (field: EditableField) => {
    const value = draft[field];
    return Array.isArray(value) ? value.join(', ') : String(value);
  };
  const update = (field: EditableField, value: string) => {
    if (field === 'price') setDraft((current) => ({ ...current, price: Number(value.replace(/\D/g, '')) || 0 }));
    else if (field === 'components' || field === 'defects') setDraft((current) => ({ ...current, [field]: value.split(',').map((item) => item.trim()).filter(Boolean) }));
    else setDraft((current) => ({ ...current, [field]: value }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="닫기" style={styles.overlay} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}><Text style={commonStyles.title}>분석 전 정보 확인</Text><Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>닫기</Text></Pressable></View>
            {(Object.keys(labels) as EditableField[]).map((field) => (
              <View key={field}>
                <Text style={commonStyles.label}>{labels[field]}</Text>
                {editing ? <AppTextInput value={valueFor(field)} keyboardType={field === 'price' ? 'number-pad' : 'default'} onChangeText={(value) => update(field, value)} /> : <Text style={commonStyles.body}>{field === 'price' ? `${draft.price.toLocaleString()}원` : valueFor(field) || '정보 없음'}</Text>}
              </View>
            ))}
            <AppButton title={editing ? '수정 완료' : '정보 수정'} variant="secondary" onPress={() => setEditing((value) => !value)} />
            <AppButton title={isAnalyzing ? '분석 중...' : '분석 시작'} disabled={isAnalyzing} onPress={() => onAnalyze(draft)} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: { maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: spacing.sm },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { color: colors.primary, fontSize: 16, padding: spacing.sm },
});
