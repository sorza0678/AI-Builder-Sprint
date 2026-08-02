import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ErrorState, LoadingState, ScreenContainer } from '@/src/components/common';
import { AnalysisResultView } from '@/src/components/analysis-result-view';
import { upsertRecentAnalysis } from '@/src/repositories/recent-analysis-repository';
import { getAnalysisResult } from '@/src/services/analysis-service';
import { AnalysisResult } from '@/src/types/marketplace';

export default function AnalysisResultScreen() {
  const { analysisId } = useLocalSearchParams<{ analysisId?: string | string[] }>();
  const id = typeof analysisId === 'string' ? analysisId : undefined;
  const [result, setResult] = useState<AnalysisResult>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');

    if (!id) {
      setError('분석 ID가 없습니다.');
      setLoading(false);
      return undefined;
    }

    let active = true;
    getAnalysisResult(id)
      .then((data) => {
        if (!active) {
          return;
        }
        if (data) {
          setResult(data);
          upsertRecentAnalysis(data);
          return;
        }
        setError('분석 결과를 찾을 수 없습니다.');
      })
      .catch(() => {
        if (active) {
          setError('분석 결과를 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error || !result) {
    return (
      <ScreenContainer scroll={false}>
        <ErrorState message={error || '결과가 없습니다.'} onRetry={load} />
      </ScreenContainer>
    );
  }

  return <AnalysisResultView result={result} />;
}
