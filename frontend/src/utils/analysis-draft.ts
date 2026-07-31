import type { AnalysisDraft } from '../types/analysis-input';
import { isValidUrl, normalizeUrl } from './url-validation';

// URL 또는 이미지가 있고 URL 오류와 제출 중 상태가 없을 때만 제출을 허용합니다.
export function canSubmitAnalysisDraft(
  draft: AnalysisDraft,
  isSubmitting = false,
): boolean {
  if (isSubmitting) {
    return false;
  }

  const normalizedUrl = normalizeUrl(draft.url);
  const hasUrl = normalizedUrl.length > 0;
  const hasImage = draft.image !== null;

  return (hasUrl || hasImage) && isValidUrl(normalizedUrl);
}

// React 상태를 안전하게 교체할 수 있도록 매번 새로운 빈 초안을 반환합니다.
export function resetAnalysisDraft(): AnalysisDraft {
  return {
    url: '',
    image: null,
  };
}
