/**
 * Image validation error codes
 */
export type ImageValidationError = 
  | 'UNSUPPORTED_TYPE' 
  | 'TOO_LARGE' 
  | 'CORRUPT'
  | 'INVALID_DIMENSIONS';

export type ImageValidationIssueSeverity = 'error' | 'warning' | 'info';

export interface ImageValidationIssue {
  severity: ImageValidationIssueSeverity;
  messageKey: string;
  messageParams?: Record<string, unknown>;
}

export function normalizeImageValidationIssues(
  issues: Array<ImageValidationIssue | null | undefined>,
): ImageValidationIssue[] {
  return issues.filter(
    (issue): issue is ImageValidationIssue => !!issue && !!issue.messageKey,
  );
}

export function buildImageValidationIssues(options: {
  errorKey?: string | null;
  errorParams?: Record<string, unknown>;
  warningKey?: string | null;
  warningParams?: Record<string, unknown>;
}): ImageValidationIssue[] {
  return normalizeImageValidationIssues([
    options.errorKey
      ? {
          severity: "error" as const,
          messageKey: options.errorKey,
          messageParams: options.errorParams,
        }
      : null,
    options.warningKey
      ? {
          severity: "warning" as const,
          messageKey: options.warningKey,
          messageParams: options.warningParams,
        }
      : null,
  ]);
}

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
  knownDims?: ImageDims;
}

export interface PreparedImageForWorkflow {
  source: File;
  originalDims: ImageDims;
  workingFile: File;
  workingDims: ImageDims;
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
  disabled?: boolean;
}

/**
 * Background settings for composition
 */
export type BackgroundMode = "transparent" | "color" | "blur" | "background" | "texture";
export type BackgroundSource = "same-image";
export type CoverColorMode = "color" | "black-white" | "grayscale";
export type CleanupStrength = "off" | "light" | "balanced" | "strong";
export type DitheringMode = "none" | "floyd-steinberg" | "ordered";
export type ArtifactReductionMode =
  | "none"
  | "bw-dither"
  | "adaptive-color"
  | "adaptive-gray";

export const BACKGROUNDS_BASE_PATH = "assets/backgrounds";
export const TEXTURES_BASE_PATH = BACKGROUNDS_BASE_PATH;

export interface BackgroundCatalogItem {
  id: string;
  label: string;
  file: string;
  defaultIntensity: number;
  tileSize?: number;
  enabled?: boolean;
}

export interface FitBackgroundConfig {
  textureId: string;
  file: string;
  intensity: number;
  scale: number;
  offsetX?: number;
  offsetY?: number;
}

export type TextureCatalogItem = BackgroundCatalogItem;
export type FitTextureConfig = FitBackgroundConfig;

export function getBackgroundAssetPath(background: { file: string }): string {
  const file = (background.file || "").trim();
  if (!file) return BACKGROUNDS_BASE_PATH;
  if (file.startsWith("assets/")) return file;
  return `${BACKGROUNDS_BASE_PATH}/${file}`;
}

export const getTextureAssetPath = getBackgroundAssetPath;

export interface ImageCleanupSettings {
  enabled: boolean;
  artifactReduction: CleanupStrength;
  smoothGradients: boolean;
  preserveDetails: boolean;
}

export interface DitheringSettings {
  enabled: boolean;
  mode: DitheringMode;
  intensity?: number;
}

export interface OutputProcessingSettings {
  cleanup: ImageCleanupSettings;
  dithering: DitheringSettings;
}

/**
 * Text layer for editor overlays
 */
export interface TextLayer {
  id: string;
  content: string;
  x: number;
  y: number;
  fontFamily: string;
  fontSizePx: number;
  manualFontSizePx?: number;
  fillColor: string;
  strokeColor: string;
  strokeWidthPx: number;
  maxWidthPx?: number;
  boxWidthPx?: number;
  boxHeightPx?: number;
  autoFitLocked?: boolean;
  userBoxTouched?: boolean;
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
  sharpness?: number;
  eReaderOptimizationEnabled?: boolean;
  bw: boolean;
  dither: boolean;
  artifactReductionEnabled?: boolean;
  cleanup?: ImageCleanupSettings;
  dithering?: DitheringSettings;
  rot: number;
  flipX?: boolean;
  flipY?: boolean;
  backgroundMode?: BackgroundMode;
  backgroundColor?: string;
  backgroundSource?: BackgroundSource;
  backgroundBlur?: number;
  backgroundPattern?: FitBackgroundConfig;
  backgroundTexture?: FitBackgroundConfig;
  textLayers?: TextLayer[];
  textLayer?: TextLayer | null;
  frameWidth?: number;
  frameHeight?: number;
}

/**
 * Composition model for rendering/preview/export
 */
export interface CompositionModel {
  cropWidth: number;
  cropHeight: number;
  imageState: CoverCropState;
  backgroundMode?: BackgroundMode;
  backgroundColor?: string;
  backgroundSource?: BackgroundSource;
  backgroundPattern?: FitBackgroundConfig;
  backgroundTexture?: FitBackgroundConfig;
}

/**
 * Labels used by the cropper UI
 */
export interface CropperLabels {
  title: string;
  cancelLabel: string;
  doneLabel: string;
  applyLabel: string;
  discardLabel: string;
  loadingLabel: string;
  hintLabel: string;
  adjustmentsLabel: string;
  toolsLabel: string;
  modelLabel: string;
  cropLabel: string;
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
  undoLabel?: string;
  redoLabel?: string;
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
  renderedBlob?: Blob;
  renderedWidth?: number;
  renderedHeight?: number;
  renderedMimeType?: string;
  history?: import("../editor/editor-history.service").EditorHistorySnapshot;
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
