// 사용자가 입력하거나 붙여넣은 URL의 앞뒤 공백을 제거합니다.
export function normalizeUrl(value: string): string {
  return value.trim();
}

// 공유 문구나 줄바꿈이 섞인 클립보드 문자열에서 첫 번째 HTTP(S) URL만 추출합니다.
export function extractFirstHttpUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s<>"'`]+/iu);
  if (!match) {
    return null;
  }

  let candidate = match[0].replace(/[.,!?;:，。！？；：…’”」』》〉]+$/u, '');
  const bracketPairs = [
    [')', '('],
    [']', '['],
    ['}', '{'],
  ] as const;

  for (const [closing, opening] of bracketPairs) {
    while (
      candidate.endsWith(closing) &&
      candidate.split(closing).length > candidate.split(opening).length
    ) {
      candidate = candidate.slice(0, -1);
    }
  }

  try {
    const parsedUrl = new URL(candidate);
    if (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      parsedUrl.hostname.length > 0
    ) {
      return candidate;
    }
  } catch {
    return null;
  }

  return null;
}

// 빈 값 또는 hostname이 있는 HTTP(S) URL만 유효한 입력으로 봅니다.
export function isValidUrl(value: string): boolean {
  const normalizedValue = normalizeUrl(value);
  if (normalizedValue.length === 0) {
    return true;
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    return (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      parsedUrl.hostname.length > 0
    );
  } catch {
    return false;
  }
}

// 화면에서 바로 표시할 수 있는 URL 오류 문구를 반환합니다.
export function getUrlError(value: string): string | null {
  return isValidUrl(value) ? null : '올바른 링크를 입력해 주세요.';
}
