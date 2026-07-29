import type { AnalysisDraft } from '../types/analysis-input';
import { isValidUrl, normalizeUrl } from './url-validation';

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

export function resetAnalysisDraft(): AnalysisDraft {
  return {
    url: '',
    image: null,
  };
}
