import { Listing } from '@/src/types/marketplace';

export const mockListings: Listing[] = [
  {
    id: 'listing-1', title: '맥북 에어 M2 13인치', platform: '중고나라', imageUrl: null,
    sourceUrl: 'https://example.com/listing/1', price: 850000, modelName: 'MacBook Air M2',
    year: '2022', sizeOrCapacity: '256GB / 8GB', color: '미드나이트', usagePeriod: '1년 6개월',
    components: ['본체', '충전기', '박스'], defects: ['모서리 미세 찍힘'],
    sellerDescription: '배터리 성능 91%, 정상 작동합니다.', saved: true,
  },
  {
    id: 'listing-2', title: '아이패드 프로 11 4세대', platform: '번개장터', imageUrl: null,
    sourceUrl: 'https://example.com/listing/2', price: 920000, modelName: 'iPad Pro 11 4th',
    year: '2023', sizeOrCapacity: '128GB', color: '스페이스 그레이', usagePeriod: '8개월',
    components: ['본체', '케이스'], defects: ['충전기 없음'],
    sellerDescription: '액정 필름 부착, 생활 기스 있습니다.', saved: false,
  },
  {
    id: 'listing-3', title: '소니 WH-1000XM5', platform: '당근', imageUrl: null,
    sourceUrl: 'https://example.com/listing/3', price: 210000, modelName: 'WH-1000XM5',
    year: '2022', sizeOrCapacity: 'Free', color: '블랙', usagePeriod: '2년',
    components: ['본체', '케이스', '케이블'], defects: ['헤드밴드 사용감', '영수증 없음'],
    sellerDescription: '직거래만 가능합니다.', saved: true,
  },
];
