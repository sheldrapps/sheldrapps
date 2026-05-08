export type ExportQualityMode = 'thumbnail' | 'compressed' | 'best';

export interface ExportQualityOption {
  id: ExportQualityMode;
  titleKey: string;
  descriptionKey: string;
  isPro: boolean;
}

export interface CoverExportOptions {
  mode: ExportQualityMode;
  mimeType: 'image/png' | 'image/jpeg';
  extension: 'png' | 'jpg';
  quality?: number;
  maxDimension?: number;
}

export const DEFAULT_EXPORT_QUALITY_MODE: ExportQualityMode = 'compressed';
export const COMPRESSED_COVER_EXPORT_QUALITY = 0.88;
export const THUMBNAIL_COVER_EXPORT_QUALITY = 0.72;
export const THUMBNAIL_COVER_EXPORT_MAX_DIMENSION = 800;

export const EXPORT_QUALITY_OPTIONS: ExportQualityOption[] = [
  {
    id: 'thumbnail',
    titleKey: 'EXPORT_QUALITY.THUMBNAIL.TITLE',
    descriptionKey: 'EXPORT_QUALITY.THUMBNAIL.DESCRIPTION',
    isPro: true,
  },
  {
    id: 'compressed',
    titleKey: 'EXPORT_QUALITY.COMPRESSED.TITLE',
    descriptionKey: 'EXPORT_QUALITY.COMPRESSED.DESCRIPTION',
    isPro: false,
  },
  {
    id: 'best',
    titleKey: 'EXPORT_QUALITY.BEST.TITLE',
    descriptionKey: 'EXPORT_QUALITY.BEST.DESCRIPTION',
    isPro: true,
  },
];

export function canUseExportQualityMode(
  mode: ExportQualityMode,
  isPro: boolean,
): boolean {
  if (mode === 'compressed') {
    return true;
  }

  return isPro;
}

export function coerceExportQualityMode(
  value: unknown,
): ExportQualityMode | undefined {
  switch (value) {
    case 'thumbnail':
    case 'compressed':
    case 'best':
      return value;
    case 'optimized':
      return 'compressed';
    case 'lossless':
      return 'best';
    default:
      return undefined;
  }
}

export function normalizeExportQualityMode(
  mode: ExportQualityMode | null | undefined,
  isPro: boolean,
): ExportQualityMode {
  const safeMode = mode ?? DEFAULT_EXPORT_QUALITY_MODE;

  if (!canUseExportQualityMode(safeMode, isPro)) {
    return DEFAULT_EXPORT_QUALITY_MODE;
  }

  return safeMode;
}

export function migrateLegacyExportQualityMode(args: {
  exportQualityMode?: unknown;
  coverExportMode?: unknown;
  bestQuality?: unknown;
}): ExportQualityMode {
  const explicitMode =
    coerceExportQualityMode(args.exportQualityMode) ??
    coerceExportQualityMode(args.coverExportMode);

  if (explicitMode) {
    return explicitMode;
  }

  if (args.bestQuality === true) {
    return 'best';
  }

  if (args.bestQuality === false) {
    return 'compressed';
  }

  return DEFAULT_EXPORT_QUALITY_MODE;
}

export function getCoverExportOptions(
  mode: ExportQualityMode,
): CoverExportOptions {
  switch (mode) {
    case 'thumbnail':
      return {
        mode,
        mimeType: 'image/jpeg',
        extension: 'jpg',
        quality: THUMBNAIL_COVER_EXPORT_QUALITY,
        maxDimension: THUMBNAIL_COVER_EXPORT_MAX_DIMENSION,
      };
    case 'best':
      return {
        mode,
        mimeType: 'image/png',
        extension: 'png',
      };
    case 'compressed':
    default:
      return {
        mode,
        mimeType: 'image/jpeg',
        extension: 'jpg',
        quality: COMPRESSED_COVER_EXPORT_QUALITY,
      };
  }
}