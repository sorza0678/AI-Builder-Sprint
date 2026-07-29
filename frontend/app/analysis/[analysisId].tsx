import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton, commonStyles, ErrorState, LoadingState, ScreenContainer } from '@/src/components/common';
import { ChecklistPreview, ConditionEvaluationCard, ListingSummaryCard, PriceEvaluationCard, RiskSignalCard } from '@/src/components/analysis-cards';
import { getAnalysisResult } from '@/src/services/analysis-service';
import { AnalysisResult } from '@/src/types/marketplace';

export default function AnalysisResultScreen() {
  const { analysisId } = useLocalSearchParams<{ analysisId?: string | string[] }>();
  const id = typeof analysisId === 'string' ? analysisId : undefined;
  const [result, setResult] = useState<AnalysisResult>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true); setError('');
    if (!id) { setError('올바른 분석 ID가 없습니다.'); setLoading(false); return; }
    let active = true;
    getAnalysisResult(id).then((data) => { if (!active) return; if (data) setResult(data); else setError('분석 결과를 찾을 수 없습니다.'); }).catch(() => { if (active) setError('분석 결과를 불러오지 못했습니다.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  if (loading) return <ScreenContainer scroll={false}><LoadingState /></ScreenContainer>;
  if (error || !result) return <ScreenContainer scroll={false}><ErrorState message={error || '결과가 없습니다.'} onRetry={load} /></ScreenContainer>;
  return <ScreenContainer><Text style={commonStyles.title}>분석 결과</Text><Text style={commonStyles.muted}>분석 시각 {new Date(result.analyzedAt).toLocaleString('ko-KR')}</Text><ListingSummaryCard result={result} /><PriceEvaluationCard result={result} /><ConditionEvaluationCard result={result} /><RiskSignalCard result={result} /><ChecklistPreview result={result} /><Text style={commonStyles.muted}>이 결과는 Mock 데이터 기반 참고 정보입니다. 거래 전 제품과 판매자 정보를 직접 확인하세요.</Text><AppButton title="비교하기" onPress={() => router.push('/compare')} /><AppButton title="거래 준비하기" variant="secondary" onPress={() => router.push(`/trade/${result.id}`)} /><AppButton title="홈으로 돌아가기" variant="secondary" onPress={() => router.replace('/home')} /></ScreenContainer>;
}
