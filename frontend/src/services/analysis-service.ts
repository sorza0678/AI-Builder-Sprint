import { mockAnalysisResults } from '@/src/mocks/analysis-results';
import { AnalysisResult, Listing } from '@/src/types/marketplace';

// 분석 ID에 해당하는 Mock 결과를 조회합니다.
export async function getAnalysisResult(id: string): Promise<AnalysisResult | undefined> {
  return mockAnalysisResults.find((result) => result.id === id);
}

// 비교 화면에서 사용할 전체 Mock 분석 결과를 반환합니다.
export async function getAnalysisResults(): Promise<AnalysisResult[]> {
  return mockAnalysisResults;
}

// 실제 분석 API가 연결되기 전까지 확인된 매물로 Mock 결과를 생성합니다.
export async function createMockAnalysis(listing: Listing): Promise<AnalysisResult> {
  const existing = mockAnalysisResults.find((result) => result.listing.id === listing.id);
  return existing ?? { ...mockAnalysisResults[0], id: 'mock-analysis-1', listing };
}
