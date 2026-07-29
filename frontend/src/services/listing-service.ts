import { mockListings } from '@/src/mocks/listings';
import { Listing } from '@/src/types/marketplace';

export async function getRecentListings(): Promise<Listing[]> {
  return mockListings;
}

export async function getSavedListings(): Promise<Listing[]> {
  return mockListings.filter((listing) => listing.saved);
}

export async function getListingById(id: string): Promise<Listing | undefined> {
  return mockListings.find((listing) => listing.id === id);
}
