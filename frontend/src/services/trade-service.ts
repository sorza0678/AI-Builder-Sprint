import { apiRequest, query } from './api-client';
import type {
  ApiTransactionDecision,
  ApiTransactionStage,
  ChecklistData,
  InquiryScriptData,
  PriceProposalData,
  TransactionItem,
} from './api-types';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';

export async function getChecklist(item_id: number) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<ChecklistData>('/api/v1/checklist', { method: 'POST', body: JSON.stringify({ user_id, item_id }) });
}
export async function getInquiryScript(item_id: number) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<InquiryScriptData>('/api/v1/inquiry-script', { method: 'POST', body: JSON.stringify({ user_id, item_id }) });
}
export async function fetchPriceProposal(item_id: number) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<PriceProposalData>('/api/v1/price-proposal', { method: 'POST', body: JSON.stringify({ user_id, item_id }) });
}
export async function setTransaction(item_id: number, stage: ApiTransactionStage, decision: ApiTransactionDecision | null) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<{ item_id: number; stage: ApiTransactionStage; decision: ApiTransactionDecision | null; updated_at: string }>('/api/v1/transaction', { method: 'POST', body: JSON.stringify({ user_id, item_id, stage, decision }) });
}
export async function getTransactions(stage?: ApiTransactionStage, decision?: ApiTransactionDecision) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<{ items: TransactionItem[]; total: number }>(`/api/v1/transaction?${query({ user_id, stage, decision })}`);
}
