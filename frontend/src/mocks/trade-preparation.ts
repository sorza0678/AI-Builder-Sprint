export interface TradeQuestion {
  id: string;
  text: string;
  reason: string;
  required: boolean;
}

export type TradeMethod = 'delivery' | 'undecided' | 'inPerson';

export interface TradeChecklistItem {
  id: string;
  text: string;
  description: string;
  group: 'before' | 'onsite' | 'payment';
}

// TODO: 백엔드 거래 준비 API가 확정되면 화면 전용 질문을 실제 응답으로 교체
export const TRADE_QUESTIONS: TradeQuestion[] = [
  {
    id: 'manufacture-year',
    text: '정확한 제조 연도가 어떻게 되나요?',
    reason: '제조 연도에 따라 제품의 시세와 차량 호환 여부가 달라질 수 있어요.',
    required: true,
  },
  {
    id: 'additional-defects',
    text: '스크래치 외에 추가 하자가 있나요?',
    reason: '사진에 보이지 않는 변형이나 수리 이력이 있으면 추가 비용이 발생할 수 있어요.',
    required: true,
  },
  {
    id: 'meeting-location',
    text: '직거래 장소는 어디인가요?',
    reason: '제품을 충분히 확인할 수 있는 밝고 안전한 장소인지 미리 확인하는 것이 좋아요.',
    required: true,
  },
  {
    id: 'wheel-only',
    text: '타이어 없이 휠만 판매하는 게 맞나요?',
    reason: '판매 범위를 정확히 확인하면 예상하지 못한 추가 구매 비용을 줄일 수 있어요.',
    required: false,
  },
  {
    id: 'bolt-pattern',
    text: '5x114.3 볼팅 패턴이 맞나요?',
    reason: '차량과 볼팅 패턴이 맞지 않으면 휠을 장착할 수 없어요.',
    required: false,
  },
];

export const TRADE_CHECKLIST_ITEMS: TradeChecklistItem[] = [
  {
    id: 'listing-match',
    text: '제품 설명과 실제 정보 일치 여부',
    description: '판매글의 모델명, 제조 연도와 실제 제품 정보가 같은지 확인하세요.',
    group: 'before',
  },
  {
    id: 'components-count',
    text: '구성품(휠 4개) 수량 확인',
    description: '판매자가 안내한 구성품이 빠짐없이 준비됐는지 확인하세요.',
    group: 'before',
  },
  {
    id: 'seller-identity',
    text: '판매자 계정·신원 확인',
    description: '거래 내역이 많고 평점이 높은 판매자인지 확인하세요.',
    group: 'before',
  },
  {
    id: 'scratch',
    text: '앞 휠 2개 스크래치 직접 육안 확인',
    description: '사진으로 확인한 스크래치의 실제 깊이와 범위를 확인하세요.',
    group: 'onsite',
  },
  {
    id: 'crack',
    text: '스포크·허브 크랙 여부 확인',
    description: '주행 안전에 영향을 줄 수 있는 균열이나 변형이 없는지 확인하세요.',
    group: 'onsite',
  },
  {
    id: 'bolt',
    text: '볼팅 패턴(5x114.3) 및 ET 값 확인',
    description: '차량과 호환되는 볼팅 패턴과 ET 값인지 제품 각인을 확인하세요.',
    group: 'onsite',
  },
  {
    id: 'final-price',
    text: '최종 거래 금액 구두 확인',
    description: '송금 전 판매자와 최종 금액 및 포함 품목을 다시 확인하세요.',
    group: 'payment',
  },
  {
    id: 'account-name',
    text: '계좌 명의와 판매자 정보 일치 확인',
    description: '입금 계좌 명의가 확인한 판매자 정보와 같은지 확인하세요.',
    group: 'payment',
  },
];
