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
  isDitheringEnabled,
  renderCompositionToCanvas,
  renderCompositionToFile,
  resolveArtifactReductionMode,
  resolveCoverColorMode,
  EXPORT_QUALITY_OPTIONS,
  DEFAULT_EXPORT_QUALITY_MODE,
  canUseExportQualityMode,
  coerceExportQualityMode,
  normalizeExportQualityMode,
  migrateLegacyExportQualityMode,
  getCoverExportOptions,
} from "./lib/core/pipeline";
export * from "./lib/core/preview/dither-preview";
export * from "./lib/e-reader-preview/e-reader-frame-colors";
export type {
  CoverExportOptions,
  ExportQualityMode,
  ExportQualityOption,
} from "./lib/core/pipeline/export-quality-mode";

// Angular Service (for DI compatibility)
export { ImagePipelineService } from "./lib/core/pipeline/image-pipeline.service";

// Reusable UI Components
export * from "./lib/components/e-reader-preview-frame/e-reader-preview-frame.component";
export * from "./lib/components/cover-source-actions/cover-source-actions.component";
export * from "./lib/components/current-cover-preview/current-cover-preview.component";
export * from "./lib/components/preview-editing-page/preview-editing-page.component";
export * from "./lib/components/preview-editing-page/preview-editing-page.service";
export * from "./lib/components/cover-image-state/cover-image-state.component";
export * from "./lib/components/image-validation-issues/image-validation-issues.component";
export * from "./lib/components/cover-image-state/i18n/provide-cover-image-state-i18n";
export * from "./lib/cover-source/i18n/provide-cover-source-i18n";
export * from "./lib/e-reader-preview/i18n/provide-e-reader-preview-frame-i18n";
export * from "./lib/e-reader-preview/i18n/image-workflow-i18n.service";
