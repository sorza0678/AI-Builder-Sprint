// 이미지 선택기가 반환한 값 중 분석 입력에 필요한 정보만 보관합니다.
export interface SelectedImage {
  uri: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

// 백엔드 요청 DTO가 아닌 홈 화면의 작성 중 입력 상태입니다.
export interface AnalysisDraft {
  url: string;
  image: SelectedImage | null;
}
