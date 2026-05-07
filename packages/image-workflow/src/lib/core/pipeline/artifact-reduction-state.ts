import type {
  ArtifactReductionMode,
  CoverColorMode,
  CoverCropState,
} from "../../types";

type ArtifactReductionStateLike = Pick<
  CoverCropState,
  "artifactReductionEnabled" | "dither" | "bw"
>;

export function isArtifactReductionEnabled(
  state: ArtifactReductionStateLike | null | undefined,
): boolean {
  if (!state) return false;
  if (state.artifactReductionEnabled !== undefined) {
    return !!state.artifactReductionEnabled;
  }
  return !!state.dither;
}

export function resolveCoverColorMode(
  state: Pick<CoverCropState, "bw"> | null | undefined,
): CoverColorMode {
  return state?.bw ? "black-white" : "color";
}

export function resolveArtifactReductionMode(
  state: ArtifactReductionStateLike | null | undefined,
): ArtifactReductionMode {
  if (!isArtifactReductionEnabled(state)) {
    return "none";
  }

  if (state?.bw) {
    return "bw-dither";
  }

  return "adaptive-color";
}
