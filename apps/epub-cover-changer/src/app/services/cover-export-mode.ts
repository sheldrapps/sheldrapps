export type CoverExportMode = 'lossless' | 'compressed';

export interface CoverExportOptions {
  mode: CoverExportMode;
  mimeType: 'image/png' | 'image/jpeg';
  extension: 'png' | 'jpg';
  quality?: number;
}

export const DEFAULT_PRO_COVER_EXPORT_MODE: CoverExportMode = 'lossless';
export const COMPRESSED_COVER_EXPORT_QUALITY = 0.92;

export function normalizeCoverExportMode(
  value: unknown,
): CoverExportMode {
  return value === 'optimized' || value === 'compressed'
    ? 'compressed'
    : 'lossless';
}

export function getCoverExportOptions(
  mode: CoverExportMode,
): CoverExportOptions {
  if (mode === 'compressed') {
    return {
      mode,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      quality: COMPRESSED_COVER_EXPORT_QUALITY,
    };
  }

  return {
    mode,
    mimeType: 'image/png',
    extension: 'png',
  };
}
