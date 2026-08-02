import { mockListings } from '@/src/mocks/listings';
import { Listing } from '@/src/types/marketplace';
import { apiRequest } from './api-client';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';

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

export async function saveListingDetails(listing: Listing): Promise<void> {
  const user_id = await getOrCreateGuestId();
  await apiRequest('/api/v1/listing', {
    method: 'POST',
    body: JSON.stringify({
      user_id,
      item_id: Number(listing.id),
      title: listing.title,
      price: listing.price,
      model_name: listing.modelName,
      year: listing.year,
      size_or_capacity: listing.sizeOrCapacity,
      color: listing.color,
      usage_period: listing.usagePeriod,
      components: listing.components,
      defects: listing.defects,
    }),
  });
}
