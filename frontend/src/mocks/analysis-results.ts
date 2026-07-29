import { AnalysisResult } from '@/src/types/marketplace';
import { mockListings } from './listings';

export const mockAnalysisResults: AnalysisResult[] = [
  {
    id: 'mock-analysis-1', listing: mockListings[0],
    marketPrice: { min: 780000, average: 870000, max: 960000 },
    priceGrade: 'GOOD', conditionGrade: 'B', riskLevel: 'LOW',
    warningSignals: ['판매자 본인 인증 여부 확인 필요'],
    missingInformation: ['구매 영수증', '수리 이력'],
    tradeChecklist: ['일련번호 확인', '배터리 사이클 확인', '화면·키보드 테스트'],
    sellerQuestions: ['수리나 침수 이력이 있나요?', '배터리 사이클 수를 확인할 수 있나요?'],
    analyzedAt: '2026-07-29T09:00:00+09:00',
  },
  {
    id: 'mock-analysis-2', listing: mockListings[1],
    marketPrice: { min: 800000, average: 890000, max: 970000 },
    priceGrade: 'EXPENSIVE', conditionGrade: 'A', riskLevel: 'MEDIUM',
    warningSignals: ['시세보다 높은 가격', '구성품 일부 누락'],
    missingInformation: ['배터리 상태'],
    tradeChecklist: ['Face ID 확인', '화면 번인 확인'],
    sellerQuestions: ['배터리 성능을 확인할 수 있나요?'],
    analyzedAt: '2026-07-28T15:30:00+09:00',
  },
  {
    id: 'mock-analysis-3', listing: mockListings[2],
    marketPrice: { min: 190000, average: 230000, max: 270000 },
    priceGrade: 'FAIR', conditionGrade: 'C', riskLevel: 'HIGH',
    warningSignals: ['영수증 없음', '직거래 장소가 불명확함'],
    missingInformation: ['구매 시점', 'A/S 잔여 기간'],
    tradeChecklist: ['노이즈 캔슬링 확인', '양쪽 유닛 소리 확인'],
    sellerQuestions: ['시리얼 번호 사진을 받을 수 있나요?'],
    analyzedAt: '2026-07-27T11:10:00+09:00',
  },
];
