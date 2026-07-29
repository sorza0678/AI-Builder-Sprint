import { Text } from 'react-native';
import { AnalysisResult } from '@/src/types/marketplace';
import { Card, commonStyles } from './common';

export function ListingSummaryCard({ result }: { result: AnalysisResult }) {
  return <Card><Text style={commonStyles.label}>매물 기본 정보</Text><Text style={commonStyles.body}>{result.listing.title}</Text><Text style={commonStyles.muted}>{result.listing.platform} · {result.listing.price.toLocaleString()}원 · {result.listing.modelName}</Text></Card>;
}
export function PriceEvaluationCard({ result }: { result: AnalysisResult }) {
  return <Card><Text style={commonStyles.label}>가격 적정성</Text><Text style={commonStyles.badge}>{result.priceGrade}</Text><Text style={commonStyles.body}>시세 {result.marketPrice.min.toLocaleString()}원 ~ {result.marketPrice.max.toLocaleString()}원</Text><Text style={commonStyles.muted}>평균 {result.marketPrice.average.toLocaleString()}원</Text></Card>;
}
export function ConditionEvaluationCard({ result }: { result: AnalysisResult }) {
  return <Card><Text style={commonStyles.label}>상태 등급</Text><Text style={commonStyles.badge}>{result.conditionGrade} 등급</Text><Text style={commonStyles.body}>주요 하자: {result.listing.defects.join(', ') || '없음'}</Text></Card>;
}
export function RiskSignalCard({ result }: { result: AnalysisResult }) {
  return <Card><Text style={commonStyles.label}>위험도 · 주의 신호</Text><Text style={commonStyles.badge}>{result.riskLevel}</Text>{result.warningSignals.map((item) => <Text key={item} style={commonStyles.body}>• {item}</Text>)}<Text style={commonStyles.label}>정보가 부족한 항목</Text>{result.missingInformation.map((item) => <Text key={item} style={commonStyles.body}>• {item}</Text>)}</Card>;
}
export function ChecklistPreview({ result }: { result: AnalysisResult }) {
  return <Card><Text style={commonStyles.label}>거래 체크리스트</Text>{result.tradeChecklist.map((item) => <Text key={item} style={commonStyles.body}>□ {item}</Text>)}</Card>;
}
