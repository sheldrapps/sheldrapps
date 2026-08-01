import type { CropTargetUnit } from './image-types';

export const POINTS_PER_INCH = 72;
export const MILLIMETERS_PER_INCH = 25.4;

export interface PdfPageTarget {
  widthPt: number;
  heightPt: number;
}

export function toPdfPoints(
  value: number,
  unit: Extract<CropTargetUnit, 'pt' | 'mm' | 'in'>,
): number {
  switch (unit) {
    case 'pt':
      return value;
    case 'in':
      return value * POINTS_PER_INCH;
    case 'mm':
      return (value * POINTS_PER_INCH) / MILLIMETERS_PER_INCH;
  }
}

export function toPdfPageTarget(
  width: number,
  height: number,
  unit: Extract<CropTargetUnit, 'pt' | 'mm' | 'in'>,
): PdfPageTarget | null {
  const widthPt = toPdfPoints(width, unit);
  const heightPt = toPdfPoints(height, unit);
  if (
    !Number.isFinite(widthPt) ||
    !Number.isFinite(heightPt) ||
    widthPt <= 0 ||
    heightPt <= 0
  ) {
    return null;
  }
  return { widthPt, heightPt };
}
