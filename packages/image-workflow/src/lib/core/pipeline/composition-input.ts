import type { CoverCropState, CropTarget } from "../../types";
import type { CompositionRenderInput } from "./composition-render";
import {
  getRotatedSourceDims,
  normalizeRightAngleRotation,
  shouldUseFullSourceResolution,
} from "./composition-geometry";

type FrameFallback = { width: number; height: number };
type CompositionSource = {
  file: File;
  naturalWidth: number;
  naturalHeight: number;
};

export type CompositionInputArgs = {
  file: File;
  target: CropTarget;
  state: CoverCropState;
  naturalWidth: number;
  naturalHeight: number;
  frameFallback?: FrameFallback;
};

export type CompositionInputSourceSet = {
  working: CompositionSource;
  original?: CompositionSource;
};

export type CompositionInputForPurposeArgs = {
  sources: CompositionInputSourceSet;
  purpose: "preview" | "export";
  target: CropTarget;
  state: CoverCropState;
  frameFallback?: FrameFallback;
};

type FrameDimensions = {
  width: number;
  height: number;
};

const FRAME_RATIO_TOLERANCE = 0.01;

function normalizeFrameDimension(value: number | undefined): number | null {
  if (!Number.isFinite(value as number)) {
    return null;
  }

  const normalized = Math.max(1, Math.round(value as number));
  return normalized > 0 ? normalized : null;
}

function hasMatchingAspectRatio(
  frameWidth: number,
  frameHeight: number,
  targetWidth: number,
  targetHeight: number,
): boolean {
  if (!frameWidth || !frameHeight || !targetWidth || !targetHeight) {
    return false;
  }

  const frameRatio = frameWidth / frameHeight;
  const targetRatio = targetWidth / targetHeight;
  return Math.abs(frameRatio - targetRatio) <= FRAME_RATIO_TOLERANCE;
}

export function resolveFrameDimensions(args: {
  target: CropTarget;
  state?: Pick<CoverCropState, "frameWidth" | "frameHeight"> | null;
  frameFallback?: FrameFallback;
}): FrameDimensions | null {
  const fallbackWidth = normalizeFrameDimension(
    args.frameFallback?.width ?? args.target.width,
  );
  const fallbackHeight = normalizeFrameDimension(
    args.frameFallback?.height ?? args.target.height,
  );

  if (!fallbackWidth || !fallbackHeight) {
    return null;
  }

  const stateWidth = normalizeFrameDimension(args.state?.frameWidth);
  const stateHeight = normalizeFrameDimension(args.state?.frameHeight);
  if (
    stateWidth &&
    stateHeight &&
    hasMatchingAspectRatio(
      stateWidth,
      stateHeight,
      args.target.width,
      args.target.height,
    )
  ) {
    return {
      width: stateWidth,
      height: stateHeight,
    };
  }

  return {
    width: fallbackWidth,
    height: fallbackHeight,
  };
}

export function computeBaseScale(
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number,
  rot: number,
): number {
  const rr = (((rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const rnW = rr === 90 || rr === 270 ? naturalH : naturalW;
  const rnH = rr === 90 || rr === 270 ? naturalW : naturalH;
  const needW = frameW / rnW;
  const needH = frameH / rnH;
  return Math.max(needW, needH);
}

export function computeSourceCropDims(args: {
  frameWidth: number;
  frameHeight: number;
  baseScale: number;
  naturalWidth: number;
  naturalHeight: number;
  state: CoverCropState;
}): { width: number; height: number } | null {
  const {
    frameWidth,
    frameHeight,
    baseScale,
    naturalWidth,
    naturalHeight,
    state,
  } = args;

  if (!frameWidth || !frameHeight || !naturalWidth || !naturalHeight) {
    return null;
  }

  const dispScale = baseScale * state.scale;
  if (!Number.isFinite(dispScale) || dispScale <= 0) {
    return null;
  }

  const rotation = normalizeRightAngleRotation(state.rot || 0);
  const rotated = getRotatedSourceDims({
    naturalWidth,
    naturalHeight,
    rotation,
  });

  if (
    shouldUseFullSourceResolution({
      frameWidth,
      frameHeight,
      naturalWidth,
      naturalHeight,
      state,
    })
  ) {
    return {
      width: rotated.width,
      height: rotated.height,
    };
  }

  const cropWidth = Math.min(
    rotated.width,
    Math.max(1, Math.floor(frameWidth / dispScale)),
  );
  const cropHeight = Math.min(
    rotated.height,
    Math.max(1, Math.floor(frameHeight / dispScale)),
  );

  return {
    width: cropWidth,
    height: cropHeight,
  };
}

export function buildCompositionInput(
  args: CompositionInputArgs,
): Omit<CompositionRenderInput, "sourceBitmap" | "sourceBitmapPromise"> | null {
  const {
    file,
    target,
    state,
    naturalWidth,
    naturalHeight,
    frameFallback,
  } = args;

  if (!file) return null;
  if (!state) return null;
  if (!naturalWidth || !naturalHeight) return null;

  const frame = resolveFrameDimensions({ target, state, frameFallback });
  if (!frame) return null;

  const baseScale = computeBaseScale(
    frame.width,
    frame.height,
    naturalWidth,
    naturalHeight,
    state.rot,
  );

  const normalizedTarget: CropTarget = {
    width: target.width,
    height: target.height,
    output: target.output,
  };

  return {
    file,
    target: normalizedTarget,
    frameWidth: frame.width,
    frameHeight: frame.height,
    baseScale,
    naturalWidth,
    naturalHeight,
    state,
  };
}

export function buildCompositionInputForPurpose(
  args: CompositionInputForPurposeArgs,
): Omit<CompositionRenderInput, "sourceBitmap" | "sourceBitmapPromise"> | null {
  const source =
    args.purpose === "export"
      ? args.sources.original ?? args.sources.working
      : args.sources.working;

  return buildCompositionInput({
    file: source.file,
    target: args.target,
    state: args.state,
    naturalWidth: source.naturalWidth,
    naturalHeight: source.naturalHeight,
    frameFallback: args.frameFallback,
  });
}
