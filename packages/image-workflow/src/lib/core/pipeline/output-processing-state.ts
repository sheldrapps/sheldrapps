import type {
  ArtifactReductionMode,
  CleanupStrength,
  CoverCropState,
  DitheringSettings,
  ImageCleanupSettings,
  OutputProcessingSettings,
} from "../../types";

export const DEFAULT_IMAGE_CLEANUP_SETTINGS: ImageCleanupSettings = {
  enabled: false,
  artifactReduction: "off",
  smoothGradients: false,
  preserveDetails: true,
};

export const DEFAULT_DITHERING_SETTINGS: DitheringSettings = {
  enabled: false,
  mode: "floyd-steinberg",
};

export const DEFAULT_OUTPUT_PROCESSING_SETTINGS: OutputProcessingSettings = {
  cleanup: DEFAULT_IMAGE_CLEANUP_SETTINGS,
  dithering: DEFAULT_DITHERING_SETTINGS,
};

type LegacyProcessingStateLike = Pick<
  CoverCropState,
  "artifactReductionEnabled" | "bw" | "cleanup" | "dither" | "dithering"
>;

export function isCleanupEnabled(
  state: LegacyProcessingStateLike | null | undefined,
): boolean {
  return resolveImageCleanupSettings(state).enabled;
}

export function isDitheringEnabled(
  state: LegacyProcessingStateLike | null | undefined,
): boolean {
  return resolveDitheringSettings(state).enabled;
}

export function resolveImageCleanupSettings(
  state: LegacyProcessingStateLike | null | undefined,
): ImageCleanupSettings {
  const cleanup = state?.cleanup;
  const legacyCleanupEnabled = resolveLegacyCleanupEnabled(state);
  const artifactReduction =
    cleanup?.artifactReduction ??
    (legacyCleanupEnabled ? "balanced" : DEFAULT_IMAGE_CLEANUP_SETTINGS.artifactReduction);
  const normalizedStrength = normalizeCleanupStrength(artifactReduction);

  return {
    enabled: cleanup?.enabled ?? legacyCleanupEnabled,
    artifactReduction: normalizedStrength,
    smoothGradients:
      cleanup?.smoothGradients ?? legacyCleanupEnabled,
    preserveDetails:
      cleanup?.preserveDetails ?? DEFAULT_IMAGE_CLEANUP_SETTINGS.preserveDetails,
  };
}

export function resolveDitheringSettings(
  state: LegacyProcessingStateLike | null | undefined,
): DitheringSettings {
  const dithering = state?.dithering;
  const legacyDitherEnabled = resolveLegacyDitherEnabled(state);

  return {
    enabled: dithering?.enabled ?? legacyDitherEnabled,
    mode: normalizeDitheringMode(
      dithering?.mode ?? DEFAULT_DITHERING_SETTINGS.mode,
    ),
    intensity: normalizeDitheringIntensity(dithering?.intensity),
  };
}

export function resolveOutputProcessingSettings(
  state: LegacyProcessingStateLike | null | undefined,
): OutputProcessingSettings {
  return {
    cleanup: resolveImageCleanupSettings(state),
    dithering: resolveDitheringSettings(state),
  };
}

export function resolveCleanupArtifactReductionMode(
  state: LegacyProcessingStateLike | null | undefined,
): ArtifactReductionMode {
  const cleanup = resolveImageCleanupSettings(state);
  if (!cleanup.enabled) {
    return "none";
  }

  const hasCleanupWork =
    cleanup.artifactReduction !== "off" || cleanup.smoothGradients;
  if (!hasCleanupWork) {
    return "none";
  }

  return state?.bw ? "adaptive-gray" : "adaptive-color";
}

export function normalizeCleanupStrength(
  value: CleanupStrength | string | null | undefined,
): CleanupStrength {
  if (
    value === "off" ||
    value === "light" ||
    value === "balanced" ||
    value === "strong"
  ) {
    return value;
  }
  return DEFAULT_IMAGE_CLEANUP_SETTINGS.artifactReduction;
}

function normalizeDitheringMode(
  value: DitheringSettings["mode"] | string | null | undefined,
): DitheringSettings["mode"] {
  if (
    value === "none" ||
    value === "floyd-steinberg" ||
    value === "ordered"
  ) {
    return value;
  }
  return DEFAULT_DITHERING_SETTINGS.mode;
}

function normalizeDitheringIntensity(
  value: number | null | undefined,
): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const clamped = Math.max(0, Math.min(1, value as number));
  return Math.round(clamped * 1000) / 1000;
}

function resolveLegacyCleanupEnabled(
  state: LegacyProcessingStateLike | null | undefined,
): boolean {
  if (!state) return false;
  if (state.cleanup) {
    return !!state.cleanup.enabled;
  }
  if (state.artifactReductionEnabled !== undefined) {
    return !!state.artifactReductionEnabled;
  }
  if (state.dithering) {
    return false;
  }
  return !!state.dither;
}

function resolveLegacyDitherEnabled(
  state: LegacyProcessingStateLike | null | undefined,
): boolean {
  if (!state) return false;
  if (state.dithering) {
    return !!state.dithering.enabled;
  }
  if (state.cleanup || state.artifactReductionEnabled !== undefined) {
    return !!state.dither;
  }
  return !!state.bw && !!state.dither;
}
