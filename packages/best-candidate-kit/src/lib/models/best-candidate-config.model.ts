export interface BestCandidateConfig {
  maxCandidates: number;
  minWidth?: number;
  minHeight?: number;
  minPixels?: number;
  preferredRatios?: number[];
  allowVeryWideImages?: boolean;
  allowVeryTallImages?: boolean;
  filenameBoosts?: string[];
  filenamePenalties?: string[];
  preferEarlyImages?: boolean;
}

export const DEFAULT_BEST_CANDIDATE_CONFIG: BestCandidateConfig = {
  maxCandidates: 3,
  minWidth: 300,
  minHeight: 400,
  minPixels: 160000,
  preferredRatios: [0.625, 0.666, 0.7],
  allowVeryWideImages: false,
  allowVeryTallImages: true,
  filenameBoosts: ['cover', 'front', 'title', 'portada', 'cubierta'],
  filenamePenalties: ['logo', 'icon', 'avatar', 'separator', 'ornament', 'bullet'],
  preferEarlyImages: true,
};
