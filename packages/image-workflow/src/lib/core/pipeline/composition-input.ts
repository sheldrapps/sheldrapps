import type { CoverCropState, CropTarget } from "../../types";
import type { CompositionRenderInput } from "./composition-render";

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

  const rotation = (((state.rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const rotatedWidth =
    rotation === 90 || rotation === 270 ? naturalHeight : naturalWidth;
  const rotatedHeight =
    rotation === 90 || rotation === 270 ? naturalWidth : naturalHeight;

  const cropWidth = Math.min(
    rotatedWidth,
    Math.max(1, Math.floor(frameWidth / dispScale)),
  );
  const cropHeight = Math.min(
    rotatedHeight,
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

  const frameW =
    (Number.isFinite(state.frameWidth as number)
      ? (state.frameWidth as number)
      : undefined) ??
    frameFallback?.width ??
    target.width;

  const frameH =
    (Number.isFinite(state.frameHeight as number)
      ? (state.frameHeight as number)
      : undefined) ??
    frameFallback?.height ??
    target.height;

  if (!frameW || !frameH) return null;

  const baseScale = computeBaseScale(
    frameW,
    frameH,
    naturalWidth,
    naturalHeight,
    state.rot,
  );

  const normalizedTarget: CropTarget = {
    width: target.width,
    height: target.height,
  };

  return {
    file,
    target: normalizedTarget,
    frameWidth: frameW,
    frameHeight: frameH,
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
