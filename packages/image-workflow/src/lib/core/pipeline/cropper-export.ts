import type { CoverCropState, CropTarget } from "../../types";
import { applyEditorAdjustments } from "./apply-editor-adjustments";
import { resolveArtifactReductionMode } from "./artifact-reduction-state";

export interface CropperExportInput {
  file: File;
  target: CropTarget;
  frameWidth: number;
  frameHeight: number;
  baseScale: number;
  naturalWidth: number;
  naturalHeight: number;
  state: CoverCropState;
  sourceBitmap?: ImageBitmap;
  sourceBitmapPromise?: Promise<ImageBitmap>;
}

const DEFAULT_EXPORT_QUALITY = 0.92;
const DEFAULT_EXPORT_MIME = "image/jpeg";

export async function renderCroppedFile(
  input: CropperExportInput,
): Promise<File | null> {
  const {
    file,
    target,
    frameWidth,
    frameHeight,
    baseScale,
    naturalWidth,
    naturalHeight,
    state,
    sourceBitmap,
    sourceBitmapPromise,
  } = input;

  if (!frameWidth || !frameHeight) return null;
  if (!naturalWidth || !naturalHeight) return null;

  const dispScale = baseScale * state.scale;
  if (!Number.isFinite(dispScale) || dispScale <= 0) return null;

  const r = (((state.rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const rotW = r === 90 || r === 270 ? naturalHeight : naturalWidth;
  const rotH = r === 90 || r === 270 ? naturalWidth : naturalHeight;

  let sWidthR = Math.floor(frameWidth / dispScale);
  let sHeightR = Math.floor(frameHeight / dispScale);

  sWidthR = Math.min(sWidthR, rotW);
  sHeightR = Math.min(sHeightR, rotH);

  let sxR = Math.round(rotW / 2 - sWidthR / 2 - state.tx / dispScale);
  let syR = Math.round(rotH / 2 - sHeightR / 2 - state.ty / dispScale);

  const maxSxR = Math.max(0, rotW - sWidthR);
  const maxSyR = Math.max(0, rotH - sHeightR);

  sxR = clamp(sxR, 0, maxSxR);
  syR = clamp(syR, 0, maxSyR);

  if (sxR + sWidthR > rotW) sxR = rotW - sWidthR;
  if (syR + sHeightR > rotH) syR = rotH - sHeightR;

  const bitmap =
    sourceBitmap ??
    (sourceBitmapPromise
      ? await sourceBitmapPromise
      : await createImageBitmap(file));

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = rotW;
  rotCanvas.height = rotH;

  const rctx = rotCanvas.getContext("2d");
  if (!rctx) return null;

  rctx.imageSmoothingEnabled = true;
  rctx.imageSmoothingQuality = "high";

  rctx.save();
  if (r === 0) {
    rctx.drawImage(bitmap, 0, 0);
  } else if (r === 90) {
    rctx.translate(rotW, 0);
    rctx.rotate(Math.PI / 2);
    rctx.drawImage(bitmap, 0, 0);
  } else if (r === 180) {
    rctx.translate(rotW, rotH);
    rctx.rotate(Math.PI);
    rctx.drawImage(bitmap, 0, 0);
  } else {
    rctx.translate(0, rotH);
    rctx.rotate(-Math.PI / 2);
    rctx.drawImage(bitmap, 0, 0);
  }
  rctx.restore();

  const outMode = target.output ?? "target";
  const outW =
    outMode === "source" ? Math.max(1, Math.round(sWidthR)) : target.width;
  const outH =
    outMode === "source" ? Math.max(1, Math.round(sHeightR)) : target.height;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, outW, outH);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const flipX = !!state.flipX;
  const flipY = !!state.flipY;

  if (flipX || flipY) {
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(
      rotCanvas,
      sxR,
      syR,
      sWidthR,
      sHeightR,
      -outW / 2,
      -outH / 2,
      outW,
      outH,
    );
    ctx.restore();
  } else {
    ctx.drawImage(rotCanvas, sxR, syR, sWidthR, sHeightR, 0, 0, outW, outH);
  }

  const imgData = ctx.getImageData(0, 0, outW, outH);
  const artifactReductionMode = resolveArtifactReductionMode(state);
  applyEditorAdjustments(imgData, state, artifactReductionMode);
  ctx.putImageData(imgData, 0, 0);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((bb) => resolve(bb), DEFAULT_EXPORT_MIME, DEFAULT_EXPORT_QUALITY),
  );

  if (!blob) return null;

  const name =
    file.name.replace(/\.(png|jpg|jpeg|webp)$/i, "") + `_cropped.jpg`;

  return new File([blob], name, { type: DEFAULT_EXPORT_MIME });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
