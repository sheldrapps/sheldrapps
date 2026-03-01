import type { CoverCropState, CropTarget } from "../../types";
import type { CompositionRenderInput } from "./composition-render";

type FrameFallback = { width: number; height: number };

export type CompositionInputArgs = {
  file: File;
  target: CropTarget;
  state: CoverCropState;
  naturalWidth: number;
  naturalHeight: number;
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
