import { BestCandidateHint, BestCandidateImage } from './best-candidate-image.model';

export interface BestCandidateResult {
  image: BestCandidateImage;
  score: number;
  reasons: BestCandidateHint[];
  warnings?: BestCandidateHint[];
}
