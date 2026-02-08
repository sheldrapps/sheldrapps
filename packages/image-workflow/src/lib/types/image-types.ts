/**
 * Image validation error codes
 */
export type ImageValidationError = 
  | 'UNSUPPORTED_TYPE' 
  | 'TOO_LARGE' 
  | 'CORRUPT'
  | 'INVALID_DIMENSIONS';

/**
 * Result of image validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: ImageValidationError;
  details?: Record<string, any>;
}

/**
 * Options for image validation
 */
export interface ImageValidationOptions {
  maxBytes: number;
  allowedMimeTypes: Set<string>;
  allowedExtensions?: Set<string>;
}

/**
 * Image dimensions
 */
export interface ImageDims {
  width: number;
  height: number;
}

/**
 * Options for preparing working images
 */
export interface WorkingImageOptions {
  maxSide: number;
  minSide?: number;
  quality: number;
  mimeType?: string;
  allowUpscale?: boolean;
}

/**
 * Unified image source (File/Blob with metadata)
 */
export interface ImageSource {
  blob: Blob;
  name?: string;
  mimeType: string;
}

/**
 * Target dimensions for cropping
 */
export interface CropTarget {
  width: number;
  height: number;
  /**
   * Output sizing mode
   * - 'target': export at target width/height (default)
   * - 'source': export at source crop size (no rescale)
   */
  output?: 'target' | 'source';
}

/**
 * Crop format option for UI selection
 */
export interface CropFormatOption {
  id: string;
  label: string;
  target: CropTarget;
}

/**
 * Crop state for persistence and restoration
 */
export interface CoverCropState {
  scale: number;
  tx: number;
  ty: number;
  brightness: number;
  saturation: number;
  contrast: number;
  bw: boolean;
  dither: boolean;
  rot: number;
}

/**
 * Labels used by the cropper UI
 */
export interface CropperLabels {
  title: string;
  cancelLabel: string;
  doneLabel: string;
  loadingLabel: string;
  hintLabel: string;
  adjustmentsLabel: string;
  toolsLabel: string;
  modelLabel: string;
  groupLabel: string;
  generationLabel: string;
  rotateLabel: string;
  rotateLeftLabel: string;
  rotateRightLabel: string;
  zoomLabel: string;
  resetAdjustmentsAriaLabel: string;
  brightnessLabel: string;
  saturationLabel: string;
  contrastLabel: string;
  bwLabel: string;
  ditherLabel: string;
  frameAriaLabel: string;
  controlsAriaLabel: string;
  resetAriaLabel: string;
  zoomOutAriaLabel: string;
  zoomInAriaLabel: string;
  adjustmentsAriaLabel: string;
}

/**
 * Input for cropper component
 */
export interface CropperInput {
  file: File;
  target: CropTarget;
  initialState?: CoverCropState;
  onReady?: () => void;
}

/**
 * Result from cropper
 */
export interface CropperResult {
  file: File;
  state?: CoverCropState;
  formatId?: string;
}

/**
 * Parameters for small image warning
 */
export interface SmallImageWarnParams {
  imgW: number;
  imgH: number;
  minW: number;
  minH: number;
}
