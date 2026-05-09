import { Injectable } from '@angular/core';
import {
  BestCandidateConfig,
  DEFAULT_BEST_CANDIDATE_CONFIG,
} from '../models/best-candidate-config.model';
import {
  BestCandidateHint,
  BestCandidateImage,
} from '../models/best-candidate-image.model';
import { BestCandidateResult } from '../models/best-candidate-score.model';

export type BestCandidateRejectedImage = {
  image: BestCandidateImage;
  reason: 'invalid-image';
};

export type BestCandidateRankingDiagnostics = {
  results: BestCandidateResult[];
  rejected: BestCandidateRejectedImage[];
};

@Injectable({ providedIn: 'root' })
export class BestCandidateService {
  rankCandidates(
    images: BestCandidateImage[],
    config?: Partial<BestCandidateConfig>,
  ): BestCandidateResult[] {
    return this.rankCandidatesWithDiagnostics(images, config).results;
  }

  rankCandidatesWithDiagnostics(
    images: BestCandidateImage[],
    config?: Partial<BestCandidateConfig>,
  ): BestCandidateRankingDiagnostics {
    const effective = this.buildConfig(config);
    const safeImages = Array.isArray(images) ? images : [];
    const rejected: BestCandidateRejectedImage[] = [];
    const ranked: BestCandidateResult[] = [];

    for (const image of safeImages) {
      if (!this.isValidImage(image)) {
        rejected.push({ image, reason: 'invalid-image' });
        continue;
      }

      const result = this.scoreImage(image, effective);
      ranked.push(result);
    }

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aArea = this.imageArea(a.image);
      const bArea = this.imageArea(b.image);
      if (bArea !== aArea) return bArea - aArea;
      const aLogoRisk = this.hasLogoRisk(a.image, effective);
      const bLogoRisk = this.hasLogoRisk(b.image, effective);
      if (aLogoRisk !== bLogoRisk) return aLogoRisk ? 1 : -1;
      const aIndex = this.indexOrMax(a.image.index);
      const bIndex = this.indexOrMax(b.image.index);
      if (aIndex !== bIndex) return aIndex - bIndex;
      const aPath = (a.image.sourcePath || a.image.fileName || a.image.id || '').toLowerCase();
      const bPath = (b.image.sourcePath || b.image.fileName || b.image.id || '').toLowerCase();
      return aPath.localeCompare(bPath);
    });

    return {
      results: ranked.slice(0, Math.max(1, effective.maxCandidates)),
      rejected,
    };
  }

  private scoreImage(
    image: BestCandidateImage,
    config: BestCandidateConfig,
  ): BestCandidateResult {
    const reasons: BestCandidateHint[] = [];
    const warnings: BestCandidateHint[] = [];
    let score = 0;

    const ratio = image.height > 0 ? image.width / image.height : 0;
    const pixels = image.width * image.height;
    const name = (image.fileName || image.sourcePath || '').toLowerCase();
    const hints = image.hints ?? [];

    if (this.matchesAny(name, config.filenameBoosts)) {
      score += 40;
      reasons.push(name.includes('front') ? 'filename-front' : 'filename-cover');
    }

    if (this.matchesCoverRatio(ratio, config.preferredRatios ?? [])) {
      score += 30;
      reasons.push('cover-ratio');
    }

    if (pixels >= 500000 || image.width >= 900 || image.height >= 1200) {
      score += 25;
      reasons.push('large-resolution');
    }

    if (config.preferEarlyImages && this.indexOrMax(image.index) <= 4) {
      score += 20;
      reasons.push('near-book-start');
    }

    if (hints.includes('first-large-image')) {
      score += 15;
      reasons.push('first-large-image');
    }

    if (hints.includes('near-book-start')) {
      score += 10;
      reasons.push('near-book-start');
    }

    if (hints.includes('metadata-cover')) {
      score += 20;
      reasons.push('metadata-cover');
    }

    if (this.isTooSmall(image, config)) {
      score -= 50;
      warnings.push('small-icon-risk');
    }

    if (this.matchesAny(name, config.filenamePenalties)) {
      score -= 35;
      warnings.push('small-icon-risk');
    }

    if (!config.allowVeryWideImages && ratio > 1.2) {
      score -= 25;
      warnings.push('decorative-risk');
    }

    if (!config.allowVeryTallImages && ratio < 0.4) {
      score -= 15;
      warnings.push('decorative-risk');
    }

    if (ratio > 2.5 || ratio < 0.32) {
      score -= 20;
      warnings.push('decorative-risk');
    }

    const uniqueReasons = this.uniqueHints(reasons);
    const uniqueWarnings = this.uniqueHints(warnings);

    return {
      image,
      score,
      reasons: uniqueReasons,
      warnings: uniqueWarnings.length ? uniqueWarnings : undefined,
    };
  }

  private buildConfig(config?: Partial<BestCandidateConfig>): BestCandidateConfig {
    return {
      ...DEFAULT_BEST_CANDIDATE_CONFIG,
      ...config,
    };
  }

  private isValidImage(image: BestCandidateImage): boolean {
    const hasPath = !!(image.sourcePath || image.fileName || image.id);
    const hasSrc = !!image.src;
    return hasPath && hasSrc;
  }

  private isTooSmall(image: BestCandidateImage, config: BestCandidateConfig): boolean {
    const minWidth = config.minWidth ?? 1;
    const minHeight = config.minHeight ?? 1;
    const minPixels = config.minPixels ?? 1;
    const pixels = image.width * image.height;
    return image.width < minWidth || image.height < minHeight || pixels < minPixels;
  }

  private matchesCoverRatio(ratio: number, preferredRatios: number[]): boolean {
    return preferredRatios.some((preferred) => Math.abs(ratio - preferred) <= 0.12);
  }

  private matchesAny(value: string, keys: string[] | undefined): boolean {
    if (!value || !keys?.length) return false;
    return keys.some((key) => value.includes(key.toLowerCase()));
  }

  private uniqueHints(hints: BestCandidateHint[]): BestCandidateHint[] {
    return Array.from(new Set(hints));
  }

  private imageArea(image: BestCandidateImage): number {
    if (!Number.isFinite(image.width) || !Number.isFinite(image.height)) return 0;
    if (image.width <= 0 || image.height <= 0) return 0;
    return image.width * image.height;
  }

  private hasLogoRisk(
    image: BestCandidateImage,
    config: BestCandidateConfig,
  ): boolean {
    const name = (image.fileName || image.sourcePath || '').toLowerCase();
    const hasPenaltyName = this.matchesAny(name, config.filenamePenalties);
    const hasPenaltyHint = (image.hints ?? []).includes('small-icon-risk');
    return hasPenaltyName || hasPenaltyHint;
  }

  private indexOrMax(index: number | undefined): number {
    return Number.isFinite(index) ? (index as number) : Number.MAX_SAFE_INTEGER;
  }
}
