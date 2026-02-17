import type { CoverCropState, CropTarget } from "../../types";

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

  ctx.drawImage(rotCanvas, sxR, syR, sWidthR, sHeightR, 0, 0, outW, outH);

  const imgData = ctx.getImageData(0, 0, outW, outH);
  const d = imgData.data;

  const b = state.brightness;
  const s = state.saturation;
  const c = state.contrast;

  if (!state.bw) {
    for (let i = 0; i < d.length; i += 4) {
      let rr = d[i],
        g = d[i + 1],
        bl = d[i + 2];

      rr = (rr - 128) * c + 128;
      g = (g - 128) * c + 128;
      bl = (bl - 128) * c + 128;

      rr *= b;
      g *= b;
      bl *= b;

      const l = 0.2126 * rr + 0.7152 * g + 0.0722 * bl;
      rr = l + (rr - l) * s;
      g = l + (g - l) * s;
      bl = l + (bl - l) * s;

      d[i] = rr < 0 ? 0 : rr > 255 ? 255 : rr;
      d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      d[i + 2] = bl < 0 ? 0 : bl > 255 ? 255 : bl;
    }

    ctx.putImageData(imgData, 0, 0);
  } else {
    const gray = new Float32Array(outW * outH);

    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const i = (y * outW + x) * 4;
        let rr = d[i],
          g = d[i + 1],
          bl = d[i + 2];

        rr = (rr - 128) * c + 128;
        g = (g - 128) * c + 128;
        bl = (bl - 128) * c + 128;

        rr *= b;
        g *= b;
        bl *= b;

        let l = 0.2126 * rr + 0.7152 * g + 0.0722 * bl;
        l = l < 0 ? 0 : l > 255 ? 255 : l;

        gray[y * outW + x] = l;
      }
    }

    if (state.dither) {
      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
          const idx = y * outW + x;
          const oldVal = gray[idx];
          const newVal = oldVal < 128 ? 0 : 255;
          const err = oldVal - newVal;
          gray[idx] = newVal;

          if (x + 1 < outW) gray[idx + 1] += (err * 7) / 16;
          if (y + 1 < outH) {
            if (x > 0) gray[idx + outW - 1] += (err * 3) / 16;
            gray[idx + outW] += (err * 5) / 16;
            if (x + 1 < outW) gray[idx + outW + 1] += err / 16;
          }
        }
      }
    }

    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const idx = y * outW + x;
        let v = gray[idx];
        v = v < 0 ? 0 : v > 255 ? 255 : v;

        const i = idx * 4;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

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
