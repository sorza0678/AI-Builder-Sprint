import { ImageSource } from 'expo-image';

export type ComparisonPriority = 'price' | 'safety' | 'condition' | 'components';

type ComparisonRowKey =
  | 'price'
  | 'sellerReliability'
  | 'condition'
  | 'defects'
  | 'components'
  | 'tradeMethod'
  | 'sellerTrust'
  | 'risk'
  | 'needsCheck';

interface ComparisonValue {
  primary: string;
  secondary?: string;
}

export interface ComparisonItem {
  id: string;
  name: string;
  price: string;
  totalScore: number;
  scores: Record<ComparisonPriority, number>;
  values: Record<ComparisonRowKey, ComparisonValue>;
}

interface PriorityContent {
  tabLabel: string;
  title: string;
  bullets: string[];
}

interface ComparisonGuide {
  id: string;
  description: string;
  product: string;
  score: number;
  icon: ImageSource;
}

export const PRIORITY_CONTENT: Record<ComparisonPriority, PriorityContent> = {
  price: {
    tabLabel: '가격우선',
    title: 'Enkei RPF1 17인치가\n더 합리적인 가격이에요',
    bullets: [
      '평균 시세보다 8% 저렴해요',
      '두 상품 중 가격 경쟁력이 가장 높아요',
      '구성품을 포함해도 부담이 적어요',
    ],
  },
  safety: {
    tabLabel: '안전성 우선',
    title: 'Enkei RPF1 17인치가\n더 안전한 거래예요',
    bullets: [
      '위험 신호 없음 — 사기 이력 없어요',
      '판매자 신뢰도 만점이에요',
      '거래 정보가 충실하게 기재됐어요',
    ],
  },
  condition: {
    tabLabel: '상태 우선',
    title: 'Enkei RPF1 17인치가\n더 좋은 상태예요',
    bullets: [
      '확인된 주요 하자가 없어요',
      '상태 등급이 한 단계 더 높아요',
      '사용 흔적이 적고 관리 상태가 좋아요',
    ],
  },
  components: {
    tabLabel: '구성품 우선',
    title: 'Enkei RPF1 17인치가\n구성품이 더 알차요',
    bullets: [
      '휠 4개와 센터캡이 모두 포함돼요',
      '추가 구매가 필요한 부품이 적어요',
      '구성품 정보가 구체적으로 기재됐어요',
    ],
  },
};

// TODO: 백엔드 비교 API가 확정되면 화면 전용 Mock 데이터를 실제 응답으로 교체
export const COMPARISON_ITEMS: ComparisonItem[] = [
  {
    id: 'enkei-rpf1',
    name: 'Enkei RPF1 17인치',
    price: '420,000원',
    totalScore: 81,
    scores: { price: 92, safety: 94, condition: 88, components: 96 },
    values: {
      price: { primary: '420,000원', secondary: '10만원 저렴' },
      sellerReliability: { primary: '–8%' },
      condition: { primary: 'A–', secondary: '한 단계 우수' },
      defects: { primary: '없음' },
      components: { primary: '휠 4개 + 센터캡', secondary: '센터캡 포함' },
      tradeMethod: { primary: '직거래/택배' },
      sellerTrust: { primary: '매우 높음' },
      risk: { primary: '위험 신호 없음', secondary: '한 단계 우수' },
      needsCheck: { primary: '1개 항목', secondary: '한 단계 우수' },
    },
  },
  {
    id: 'bbs-rs',
    name: 'BBS RS 18인치',
    price: '600,000원',
    totalScore: 74,
    scores: { price: 70, safety: 62, condition: 72, components: 68 },
    values: {
      price: { primary: '600,000원' },
      sellerReliability: { primary: '–12%' },
      condition: { primary: 'B' },
      defects: { primary: '스크래치 2곳' },
      components: { primary: '휠 4개' },
      tradeMethod: { primary: '직거래' },
      sellerTrust: { primary: '높음' },
      risk: { primary: '주의 1건' },
      needsCheck: { primary: '2개 항목' },
    },
  },
  {
    id: 'work-emotion',
    name: 'WORK Emotion 17인치',
    price: '510,000원',
    totalScore: 77,
    scores: { price: 81, safety: 76, condition: 75, components: 78 },
    values: {
      price: { primary: '510,000원' },
      sellerReliability: { primary: '–10%' },
      condition: { primary: 'B+' },
      defects: { primary: '미세 흠집' },
      components: { primary: '휠 4개' },
      tradeMethod: { primary: '직거래/택배' },
      sellerTrust: { primary: '높음' },
      risk: { primary: '주의 1건' },
      needsCheck: { primary: '2개 항목' },
    },
  },
];

export const COMPARISON_ROWS: { key: ComparisonRowKey; label: string }[] = [
  { key: 'price', label: '판매가' },
  { key: 'sellerReliability', label: '시세 대비' },
  { key: 'condition', label: '상태\n등급' },
  { key: 'defects', label: '주요\n하자' },
  { key: 'components', label: '구성품' },
  { key: 'tradeMethod', label: '거래\n방식' },
  { key: 'sellerTrust', label: '판매자\n신뢰도' },
  { key: 'risk', label: '위험\n신호' },
  { key: 'needsCheck', label: '확인\n필요' },
];

export const COMPARISON_GUIDES: ComparisonGuide[] = [
  {
    id: 'safe',
    description: '가장 안전하게 거래하고 싶다면',
    product: 'BBS RS 18인치',
    score: 81,
    icon: require('@/assets/images/compare/guide-safe.svg'),
  },
  {
    id: 'inspect',
    description: '실물 확인으로 리스크를 줄이고 싶다면',
    product: 'BBS RS 18인치',
    score: 74,
    icon: require('@/assets/images/compare/guide-inspect.svg'),
  },
  {
    id: 'best',
    description: '종합적으로 가장 적합한 상품',
    product: 'Enkei RPF1 17인치',
    score: 81,
    icon: require('@/assets/images/compare/guide-best.svg'),
  },
];
