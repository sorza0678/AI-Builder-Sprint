export const STORAGE_KEYS = {
  guestId: 'baton:guest:id',
  savedListings: 'baton:guest:saved-listings',
  comparisonCart: 'baton:guest:comparison-cart',
  comparisonHistory: 'baton:guest:comparison-history',
  checklistProgress: 'baton:guest:checklist-progress',
  tradeRecords: 'baton:guest:trade-records',
  recentAnalyses: 'baton:guest:recent-analyses',
  analysisDraft: 'baton:guest:analysis-draft',
} as const;

export const CURRENT_STORAGE_SCHEMA_VERSION = 1;
