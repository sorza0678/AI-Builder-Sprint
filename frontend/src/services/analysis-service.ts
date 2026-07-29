import { mockAnalysisResults } from '@/src/mocks/analysis-results';
import { AnalysisResult, Listing } from '@/src/types/marketplace';

export async function getAnalysisResult(id: string): Promise<AnalysisResult | undefined> {
  return mockAnalysisResults.find((result) => result.id === id);
}

export async function getAnalysisResults(): Promise<AnalysisResult[]> {
  return mockAnalysisResults;
}

export async function createMockAnalysis(listing: Listing): Promise<AnalysisResult> {
  const existing = mockAnalysisResults.find((result) => result.listing.id === listing.id);
  return existing ?? { ...mockAnalysisResults[0], id: 'mock-analysis-1', listing };
}
