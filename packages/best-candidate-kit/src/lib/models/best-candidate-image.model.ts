export type BestCandidateHint =
  | 'metadata-cover'
  | 'filename-cover'
  | 'filename-front'
  | 'first-large-image'
  | 'near-book-start'
  | 'cover-ratio'
  | 'large-resolution'
  | 'small-icon-risk'
  | 'decorative-risk';

export interface BestCandidateImage {
  id: string;
  src: string;
  sourcePath?: string;
  fileName?: string;
  width: number;
  height: number;
  mimeType?: string;
  sizeBytes?: number;
  index?: number;
  hints?: BestCandidateHint[];
  metadata?: Record<string, unknown>;
}
