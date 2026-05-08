import type { CoverCropState } from "../../types";

const EPSILON = 0.0001;

export function normalizeRightAngleRotation(
  rotation: number,
): 0 | 90 | 180 | 270 {
  return (((rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}

export function getRotatedSourceDims(args: {
  naturalWidth: number;
  naturalHeight: number;
  rotation: 0 | 90 | 180 | 270;
}): { width: number; height: number } {
  const { naturalWidth, naturalHeight, rotation } = args;

  if (rotation === 90 || rotation === 270) {
    return { width: naturalHeight, height: naturalWidth };
  }

  return { width: naturalWidth, height: naturalHeight };
}

export function shouldUseFullSourceResolution(args: {
  frameWidth: number;
  frameHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  state: CoverCropState;
}): boolean {
  const { frameWidth, frameHeight, naturalWidth, naturalHeight, state } = args;

  if (!frameWidth || !frameHeight || !naturalWidth || !naturalHeight) {
    return false;
  }

  const rotation = normalizeRightAngleRotation(state.rot || 0);
  const rotated = getRotatedSourceDims({
    naturalWidth,
    naturalHeight,
    rotation,
  });

  const frameRatio = frameWidth / frameHeight;
  const sourceRatio = rotated.width / rotated.height;
  const ratiosMatch = Math.abs(frameRatio - sourceRatio) <= EPSILON;
  const noExtraZoom = Math.abs((state.scale || 1) - 1) <= EPSILON;
  const noPan = Math.abs(state.tx || 0) <= EPSILON && Math.abs(state.ty || 0) <= EPSILON;

  return ratiosMatch && noExtraZoom && noPan;
}
