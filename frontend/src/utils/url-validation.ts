export function normalizeUrl(value: string): string {
  return value.trim();
}

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

export function getUrlError(value: string): string | null {
  return isValidUrl(value) ? null : '올바른 링크를 입력해 주세요.';
}
