import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, Card, commonStyles, LoadingState, ScreenContainer } from '@/src/components/common';
import { getAnalysisResults } from '@/src/services/analysis-service';
import { AnalysisResult } from '@/src/types/marketplace';
import { colors, spacing } from '@/src/constants/theme';

export default function CompareScreen() {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { let active = true; getAnalysisResults().then((data) => { if (active) { setResults(data); setSelected(data.slice(0, 2).map((item) => item.id)); } }); return () => { active = false; }; }, []);
  const compared = results.filter((result) => selected.includes(result.id));
  if (!results.length) return <ScreenContainer scroll={false}><LoadingState /></ScreenContainer>;
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  const fields = [
    ['판매가', (r: AnalysisResult) => `${r.listing.price.toLocaleString()}원`],
    ['적정 시세', (r: AnalysisResult) => `${r.marketPrice.average.toLocaleString()}원`],
    ['가격 적정도', (r: AnalysisResult) => r.priceGrade], ['상태 등급', (r: AnalysisResult) => r.conditionGrade],
    ['주요 하자', (r: AnalysisResult) => r.listing.defects.join(', ')], ['구성품', (r: AnalysisResult) => r.listing.components.join(', ')],
    ['판매자 신뢰 신호', (r: AnalysisResult) => r.listing.sellerDescription], ['위험 신호', (r: AnalysisResult) => r.warningSignals.join(', ')],
    ['정보 부족', (r: AnalysisResult) => r.missingInformation.join(', ')],
  ] as const;
  return <ScreenContainer><Text style={commonStyles.title}>매물 비교</Text><Text style={commonStyles.subtitle}>최대 3개 매물을 선택하세요.</Text><View style={styles.selector}>{results.map((result) => <Pressable key={result.id} onPress={() => toggle(result.id)} style={[styles.choice, selected.includes(result.id) && styles.selected]}><Text style={commonStyles.body}>{result.listing.title}</Text></Pressable>)}</View>{fields.map(([label, getValue]) => <Card key={label}><Text style={commonStyles.label}>{label}</Text>{compared.map((result) => <View key={result.id} style={styles.value}><Text style={commonStyles.muted}>{result.listing.title}</Text><Text style={commonStyles.body}>{getValue(result) || '정보 없음'}</Text></View>)}</Card>)}<AppButton title="첫 번째 매물 거래 준비" disabled={!compared[0]} onPress={() => compared[0] && router.push(`/trade/${compared[0].id}`)} /><AppButton title="마이페이지" variant="secondary" onPress={() => router.push('/mypage')} /></ScreenContainer>;
}
const styles = StyleSheet.create({ selector: { gap: spacing.sm }, choice: { minHeight: 48, justifyContent: 'center', padding: spacing.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, selected: { borderColor: colors.primary, backgroundColor: '#EAF2FF' }, value: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm } });
