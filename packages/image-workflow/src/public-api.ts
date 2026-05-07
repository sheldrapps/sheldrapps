// Editor secondary entrypoint exports
export * from "./editor/public-api";
/**
 * Public API Surface of @sheldrapps/image-workflow
 */

// Types and Contracts
export * from "./lib/types";

// Core Pipeline Functions
export {
  validateBasic,
  getDimensions,
  normalizeFile,
  materializeFile,
  prepareWorkingImage,
  getSmallWarnParams,
  DEFAULT_VALIDATION_OPTIONS,
  DEFAULT_WORKING_OPTIONS,
  buildCompositionInput,
  buildCompositionInputForPurpose,
  buildDefaultCoverCropState,
  computeBaseScale,
  computeSourceCropDims,
  applyAdaptiveColorArtifactReduction,
  isArtifactReductionEnabled,
  renderCompositionToCanvas,
  renderCompositionToFile,
  resolveArtifactReductionMode,
  resolveCoverColorMode,
} from "./lib/core/pipeline";
export * from "./lib/core/preview/dither-preview";
export * from "./lib/e-reader-preview/e-reader-frame-colors";

// Angular Service (for DI compatibility)
export { ImagePipelineService } from "./lib/core/pipeline/image-pipeline.service";

// Reusable UI Components
export * from "./lib/components/e-reader-preview-frame/e-reader-preview-frame.component";
