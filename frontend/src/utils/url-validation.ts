// 사용자가 입력하거나 붙여넣은 URL의 앞뒤 공백을 제거합니다.
export function normalizeUrl(value: string): string {
  return value.trim();
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
