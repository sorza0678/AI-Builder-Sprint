export interface SelectedImage {
  uri: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface AnalysisDraft {
  url: string;
  image: SelectedImage | null;
}
