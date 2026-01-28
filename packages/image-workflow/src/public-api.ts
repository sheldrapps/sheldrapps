/**
 * Public API Surface of @sheldrapps/image-workflow
 */

// Types and Contracts
export * from './lib/types';

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
} from './lib/core/pipeline';

// Angular Service (for DI compatibility)
export { ImagePipelineService } from './lib/core/pipeline/image-pipeline.service';

// UI Components
export { CoverCropperModalComponent } from './lib/ui/cropper';
