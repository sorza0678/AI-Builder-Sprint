import { mockListings } from '@/src/mocks/listings';
import { Listing } from '@/src/types/marketplace';

// 화면과 Mock 데이터 사이의 경계를 유지하기 위한 매물 조회 서비스입니다.
export async function getRecentListings(): Promise<Listing[]> {
  return mockListings;
}

export async function getSavedListings(): Promise<Listing[]> {
  return mockListings.filter((listing) => listing.saved);
}

export async function getListingById(id: string): Promise<Listing | undefined> {
  return mockListings.find((listing) => listing.id === id);
}
