export interface MyPageListing {
  id: string;
  location: string;
  price: string;
  title: string;
  time: string;
  recommended?: boolean;
}

// TODO: 백엔드 마이페이지 API가 확정되면 Mock 데이터를 실제 응답으로 교체
export const MY_PAGE_RECOMMENDATIONS: MyPageListing[] = [
  {
    id: 'recommendation-1',
    location: '서울 강남구',
    price: '250,000원',
    title: '캄파놀로 보라 WTO 45',
    time: '3시간 전',
    recommended: true,
  },
  {
    id: 'recommendation-2',
    location: '서울 송파구',
    price: '1,200,000원',
    title: '스페셜라이즈드 타막',
    time: '5시간 전',
  },
  {
    id: 'recommendation-3',
    location: '경기 성남시',
    price: '480,000원',
    title: '시마노 듀라에이스 휠셋',
    time: '어제',
  },
];

export const MY_PAGE_HISTORY: MyPageListing[] = [
  {
    id: 'history-1',
    location: '서울 강남구',
    price: '250,000원',
    title: '캄파놀로 보라 WTO 45',
    time: '3시간 전',
    recommended: true,
  },
  {
    id: 'history-2',
    location: '부산 해운대구',
    price: '350,000원',
    title: '자이언트 프로펠 프레임셋',
    time: '어제',
  },
  {
    id: 'history-3',
    location: '서울 마포구',
    price: '790,000원',
    title: '캐논데일 슈퍼식스 에보',
    time: '2일 전',
  },
];
