import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton, Card, commonStyles, ErrorState, LoadingState, ScreenContainer, SectionHeader } from '@/src/components/common';
import { getAnalysisResult } from '@/src/services/analysis-service';
import { AnalysisResult, TradeStatus } from '@/src/types/marketplace';
import { colors, radius, spacing } from '@/src/constants/theme';

const statuses: { value: TradeStatus; label: string }[] = [
  { value: 'INTERESTED', label: '관심 있음' }, { value: 'CONTACTED', label: '연락함' },
  { value: 'SCHEDULED', label: '일정 확정' }, { value: 'COMPLETED', label: '거래 완료' },
  { value: 'CANCELED', label: '거래 취소' },
];

export default function TradePreparationScreen() {
  const { analysisId } = useLocalSearchParams<{ analysisId?: string | string[] }>();
  const id = typeof analysisId === 'string' ? analysisId : undefined;
  const [result, setResult] = useState<AnalysisResult>();
  const [status, setStatus] = useState<TradeStatus>('INTERESTED');
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; if (!id) { setLoading(false); return; } getAnalysisResult(id).then((data) => { if (active) setResult(data); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  if (loading) return <ScreenContainer scroll={false}><LoadingState /></ScreenContainer>;
  if (!id || !result) return <ScreenContainer scroll={false}><ErrorState message="거래 준비에 필요한 분석 결과를 찾을 수 없습니다." /></ScreenContainer>;
  return <ScreenContainer><Text style={commonStyles.title}>거래 준비</Text><Text style={commonStyles.subtitle}>{result.listing.title}</Text><SectionHeader title="판매자에게 물어볼 질문" /><Card>{result.sellerQuestions.map((item) => <Text key={item} style={commonStyles.body}>• {item}</Text>)}</Card><SectionHeader title="거래 전 체크리스트" /><Card>{result.tradeChecklist.map((item) => <Text key={item} style={commonStyles.body}>□ {item}</Text>)}</Card><SectionHeader title="직거래 주의사항" /><Card><Text style={commonStyles.body}>밝고 사람이 많은 장소에서 만나 제품 작동과 일련번호를 확인하세요.</Text></Card><SectionHeader title="택배 거래 주의사항" /><Card><Text style={commonStyles.body}>안전결제를 이용하고 송장과 포장 과정을 보관하세요. 선입금 요구에 주의하세요.</Text></Card><SectionHeader title="거래 상태" /><View style={styles.statuses}>{statuses.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: status === item.value }} key={item.value} onPress={() => setStatus(item.value)} style={[styles.status, status === item.value && styles.selected]}><Text style={status === item.value ? styles.selectedText : commonStyles.body}>{item.label}</Text></Pressable>)}</View><Text style={commonStyles.muted}>현재 상태는 이 화면에만 임시 저장됩니다.</Text><AppButton title="마이페이지로 이동" onPress={() => router.push('/mypage')} /><AppButton title="분석 결과로 돌아가기" variant="secondary" onPress={() => router.back()} /></ScreenContainer>;
}
const styles = StyleSheet.create({ statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, status: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, selected: { borderColor: colors.primary, backgroundColor: colors.primary }, selectedText: { color: '#FFF', fontWeight: '700' } });
