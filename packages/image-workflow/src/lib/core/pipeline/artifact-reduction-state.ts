import type {
  ArtifactReductionMode,
  CoverColorMode,
  CoverCropState,
} from "../../types";
import {
  isCleanupEnabled,
  resolveCleanupArtifactReductionMode,
} from "./output-processing-state";

type ArtifactReductionStateLike = Pick<
  CoverCropState,
  "artifactReductionEnabled" | "bw" | "cleanup" | "dither" | "dithering"
>;

export function isArtifactReductionEnabled(
  state: ArtifactReductionStateLike | null | undefined,
): boolean {
  return isCleanupEnabled(state);
}

export function resolveCoverColorMode(
  state: Pick<CoverCropState, "bw"> | null | undefined,
): CoverColorMode {
  return state?.bw ? "black-white" : "color";
}

export function resolveArtifactReductionMode(
  state: ArtifactReductionStateLike | null | undefined,
): ArtifactReductionMode {
  return resolveCleanupArtifactReductionMode(state);
}
