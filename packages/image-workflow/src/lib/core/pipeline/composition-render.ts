import type {
  BackgroundMode,
  BackgroundSource,
  CoverCropState,
  CropTarget,
} from "../../types";
import { applyEditorAdjustments } from "./apply-editor-adjustments";
import {
  getRotatedSourceDims,
  normalizeRightAngleRotation,
  shouldUseFullSourceResolution,
} from "./composition-geometry";
import { resolveArtifactReductionMode } from "./artifact-reduction-state";

export type CompositionRenderMode = "preview" | "export";

export interface CompositionRenderInput {
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

export interface CompositionRenderOptions {
  mode: CompositionRenderMode;
  outputScale?: number;
  backgroundFallbackColor?: string;
  mimeType?: string;
  quality?: number;
  maxDimension?: number;
  debug?: boolean;
  debugLabel?: string;
}

const DEFAULT_EXPORT_QUALITY = 0.92;
const DEFAULT_EXPORT_MIME = "image/jpeg";
const DEFAULT_EXPORT_MIME_TRANSPARENT = "image/png";
const DEFAULT_BACKGROUND = "#000000";
const DEFAULT_BLUR_STRENGTH = 80;
const MAX_BLUR_PX = 40;
const TEXT_STAGE_EDGE_PAD = 15;
const TEXT_HANDLE_PAD_RIGHT = 12;

export function resolveCompositionOutputSize(args: {
  target: CropTarget;
  frameWidth: number;
  frameHeight: number;
  baseScale: number;
  naturalWidth: number;
  naturalHeight: number;
  state: CoverCropState;
  outputScale?: number;
}): { width: number; height: number } | null {
  const {
    target,
    frameWidth,
    frameHeight,
    baseScale,
    naturalWidth,
    naturalHeight,
    state,
    outputScale = 1,
  } = args;

  if (!frameWidth || !frameHeight || !naturalWidth || !naturalHeight) {
    return null;
  }

  if ((target.output ?? "target") !== "source") {
    return {
      width: Math.max(1, Math.round(target.width * outputScale)),
      height: Math.max(1, Math.round(target.height * outputScale)),
    };
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
      width: Math.max(1, Math.round(rotated.width * outputScale)),
      height: Math.max(1, Math.round(rotated.height * outputScale)),
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
    width: Math.max(1, Math.round(cropWidth * outputScale)),
    height: Math.max(1, Math.round(cropHeight * outputScale)),
  };
}

export async function renderCompositionToCanvas(
  input: CompositionRenderInput,
  options: CompositionRenderOptions,
): Promise<HTMLCanvasElement | null> {
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

  const previewMode = options.mode === "preview";
  const outputScale = options.outputScale ?? 1;
  const outputSize = resolveCompositionOutputSize({
    target,
    frameWidth,
    frameHeight,
    baseScale,
    naturalWidth,
    naturalHeight,
    state,
    outputScale: previewMode ? 1 : outputScale,
  });
  if (!outputSize) return null;

  const layoutW = outputSize.width;
  const layoutH = outputSize.height;

  const scaledW = layoutW;
  const scaledH = layoutH;

  const dispScale = baseScale * state.scale;
  if (!Number.isFinite(dispScale) || dispScale <= 0) return null;

  const frameScale = scaledW / frameWidth;

  const bitmap =
    sourceBitmap ??
    (sourceBitmapPromise
      ? await sourceBitmapPromise
      : await createImageBitmap(file));

  const backgroundMode =
    (state.backgroundMode ?? "transparent") as BackgroundMode;
  const backgroundColor =
    state.backgroundColor?.trim() || DEFAULT_BACKGROUND;
  const backgroundSource =
    (state.backgroundSource ?? "same-image") as BackgroundSource;
  const backgroundBlur =
    Number.isFinite(state.backgroundBlur) ? state.backgroundBlur! : DEFAULT_BLUR_STRENGTH;

  const canvas = document.createElement("canvas");
  canvas.width = scaledW;
  canvas.height = scaledH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const shouldDrawCheckerAfter = previewMode && backgroundMode === "transparent";

  drawBackground(ctx, {
    mode: backgroundMode,
    color: backgroundColor,
    source: backgroundSource,
    blur: backgroundBlur,
    bitmap,
    width: scaledW,
    height: scaledH,
    preview: previewMode,
    fallbackColor: options.backgroundFallbackColor,
    deferCheckerboard: shouldDrawCheckerAfter,
  });

  const scale = dispScale * frameScale;
  const tx = (state.tx || 0) * frameScale;
  const ty = (state.ty || 0) * frameScale;
  const rot = ((state.rot || 0) * Math.PI) / 180;
  const flipX = !!state.flipX;
  const flipY = !!state.flipY;
  const shouldDebug = (options.debug || options.debugLabel) && previewMode;
  if (shouldDebug) {
    const label = options.debugLabel ?? "composition-render";
    const anchorX = scaledW / 2;
    const anchorY = scaledH / 2;
    console.log(`[${label}] layout`, {
      mode: options.mode,
      canvasW: scaledW,
      canvasH: scaledH,
      layoutW,
      layoutH,
      frame: {
        width: frameWidth,
        height: frameHeight,
        padding: 0,
        radius: 0,
      },
      transform: {
        scale,
        translateX: anchorX + tx,
        translateY: anchorY + ty,
        anchorX,
        anchorY,
        rotationDeg: state.rot || 0,
        flipX,
        flipY,
      },
    });
  }

  ctx.save();
  ctx.translate(scaledW / 2 + tx, scaledH / 2 + ty);
  ctx.rotate(rot);
  ctx.scale(scale * (flipX ? -1 : 1), scale * (flipY ? -1 : 1));
  ctx.drawImage(
    bitmap,
    -naturalWidth / 2,
    -naturalHeight / 2,
    naturalWidth,
    naturalHeight,
  );
  ctx.restore();

  applyAdjustments(ctx, scaledW, scaledH, state);

  if (shouldDrawCheckerAfter) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    drawCheckerboard(ctx, scaledW, scaledH);
    ctx.restore();
  }

  const textLayers = Array.isArray(state.textLayers)
    ? state.textLayers
    : state.textLayer
      ? [state.textLayer]
      : [];

  await ensureFontsLoaded(textLayers);

  drawTextLayers(ctx, {
    layers: textLayers,
    frameWidth,
    frameHeight,
    outputWidth: scaledW,
    outputHeight: scaledH,
  });
  return canvas;
}

export async function renderCompositionToFile(
  input: CompositionRenderInput,
  options: CompositionRenderOptions,
): Promise<File | null> {
  const renderedCanvas = await renderCompositionToCanvas(input, options);
  if (!renderedCanvas) return null;

  const canvas = downscaleCanvas(renderedCanvas, options.maxDimension);

  const shouldUsePng =
    (input.state.backgroundMode ?? "transparent") === "transparent" &&
    !options.mimeType;
  const mimeType = options.mimeType ?? (shouldUsePng
    ? DEFAULT_EXPORT_MIME_TRANSPARENT
    : DEFAULT_EXPORT_MIME);
  const quality = options.quality ?? DEFAULT_EXPORT_QUALITY;

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((bb) => resolve(bb), mimeType, quality),
  );
  if (!blob) return null;

  const base = input.file.name.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  const ext = mimeType === "image/png" ? "png" : "jpg";
  return new File([blob], `${base}_composed.${ext}`, { type: mimeType });
}

function downscaleCanvas(
  src: HTMLCanvasElement,
  maxDimension?: number,
): HTMLCanvasElement {
  if (!maxDimension || maxDimension <= 0) {
    return src;
  }

  const sourceMax = Math.max(src.width, src.height);
  if (sourceMax <= maxDimension) {
    return src;
  }

  const scale = maxDimension / sourceMax;
  const dst = document.createElement("canvas");
  dst.width = Math.max(1, Math.round(src.width * scale));
  dst.height = Math.max(1, Math.round(src.height * scale));

  const ctx = dst.getContext("2d");
  if (!ctx) {
    return src;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, dst.width, dst.height);
  return dst;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  opts: {
    mode: BackgroundMode;
    color: string;
    source: BackgroundSource;
    blur: number;
    bitmap: ImageBitmap;
    width: number;
    height: number;
    preview: boolean;
    fallbackColor?: string;
    deferCheckerboard?: boolean;
  },
): void {
  const {
    mode,
    color,
    source,
    blur,
    bitmap,
    width,
    height,
    preview,
    fallbackColor,
    deferCheckerboard,
  } = opts;
  if (mode === "transparent") {
    if (preview && !deferCheckerboard) {
      drawCheckerboard(ctx, width, height);
    } else if (!preview && fallbackColor) {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(0, 0, width, height);
    }
    return;
  }

  if (mode === "color") {
    ctx.fillStyle = color || fallbackColor || DEFAULT_BACKGROUND;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (mode === "blur" && source === "same-image") {
    ctx.save();
    ctx.fillStyle = fallbackColor || DEFAULT_BACKGROUND;
    ctx.fillRect(0, 0, width, height);
    const clamped = Math.max(0, Math.min(100, blur));
    const blurPx = (clamped / 100) * MAX_BLUR_PX;
    ctx.filter = `blur(${blurPx}px)`;

    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const bw = bitmap.width * scale;
    const bh = bitmap.height * scale;
    const bx = (width - bw) / 2;
    const by = (height - bh) / 2;

    ctx.drawImage(bitmap, bx, by, bw, bh);
    ctx.restore();
  }
}

function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const size = 16;
  const light = "#f0f0f0";
  const dark = "#d9d9d9";

  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = dark;
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const isDark = ((x / size) + (y / size)) % 2 === 0;
      if (isDark) {
        ctx.fillRect(x, y, size, size);
      }
    }
  }
}

function applyAdjustments(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: CoverCropState,
): void {
  if (!width || !height) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const artifactReductionMode = resolveArtifactReductionMode(state);
  applyEditorAdjustments(imgData, state, artifactReductionMode);
  ctx.putImageData(imgData, 0, 0);
}

function drawTextLayers(
  ctx: CanvasRenderingContext2D,
  opts: {
    layers: NonNullable<CoverCropState["textLayers"]>;
    frameWidth: number;
    frameHeight: number;
    outputWidth: number;
    outputHeight: number;
  },
): void {
  const { layers, frameWidth, frameHeight, outputWidth, outputHeight } = opts;
  if (!layers?.length) return;
  if (!frameWidth || !frameHeight) return;

  const frameScale = Number.isFinite(outputWidth / frameWidth)
    ? outputWidth / frameWidth
    : 1;
  const scaledFrameW = frameWidth * frameScale;
  const scaledFrameH = frameHeight * frameScale;
  const offsetX = (outputWidth - scaledFrameW) / 2;
  const offsetY = (outputHeight - scaledFrameH) / 2;

  ctx.save();
  // Draw in frame space, scale uniformly to match image mapping.
  ctx.translate(offsetX, offsetY);
  ctx.scale(frameScale, frameScale);

  for (const layer of layers) {
    if (!layer || !layer.content) continue;

    const x = (layer.x ?? 0.5) * frameWidth;
    const y = (layer.y ?? 0.5) * frameHeight;

    const fontSize = Math.max(1, layer.fontSizePx || 1);
    const strokeWidth = Math.max(0, layer.strokeWidthPx || 0);
    const rawMaxWidth =
      Number.isFinite(layer.maxWidthPx) && (layer.maxWidthPx ?? 0) > 0
        ? (layer.maxWidthPx as number)
        : null;
    const autoMaxWidth = computeAutoMaxWidth(
      frameWidth,
      layer.x ?? 0.5,
    );
    const contentAutoMaxWidth = autoMaxWidth
      ? Math.max(1, autoMaxWidth - strokeWidth * 2)
      : null;
    const effectiveMaxWidth = rawMaxWidth && contentAutoMaxWidth
      ? Math.min(rawMaxWidth, contentAutoMaxWidth)
      : rawMaxWidth ?? contentAutoMaxWidth ?? null;

    const measurement = measureTextLayer(ctx, layer, effectiveMaxWidth);
    const lines = measurement.lines;
    const font = measurement.font;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.font = font;
    const lineHeight = measurement.lineHeight || fontSize;
    const totalHeight = lineHeight * lines.length;
    const startY = y - totalHeight / 2;

    if (strokeWidth > 0) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = layer.strokeColor || "#000000";
      lines.forEach((line, idx) => {
        ctx.strokeText(line, x, startY + idx * lineHeight);
      });
    }

    ctx.fillStyle = layer.fillColor || "#ffffff";
    lines.forEach((line, idx) => {
      ctx.fillText(line, x, startY + idx * lineHeight);
    });
    ctx.restore();
  }

  ctx.restore();
}

function computeAutoMaxWidth(frameWidth: number, normX: number): number | null {
  if (!frameWidth) return null;
  const centerX = normX * frameWidth;
  const leftSpace = Math.max(0, centerX - TEXT_STAGE_EDGE_PAD);
  const rightSpace = Math.max(
    0,
    frameWidth - centerX - TEXT_STAGE_EDGE_PAD - TEXT_HANDLE_PAD_RIGHT,
  );
  const half = Math.min(leftSpace, rightSpace);
  const maxWidth = Math.floor(half * 2);
  return maxWidth > 0 ? maxWidth : null;
}

export type TextMeasureResult = {
  lines: string[];
  width: number;
  height: number;
  lineHeight: number;
  font: string;
};

export function measureTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: {
    content?: string | null;
    fontFamily?: string | null;
    fontSizePx?: number | null;
    strokeWidthPx?: number | null;
  },
  maxWidth?: number | null,
): TextMeasureResult {
  const fontSize = Math.max(1, Number(layer.fontSizePx) || 1);
  const strokeWidth = Math.max(0, Number(layer.strokeWidthPx) || 0);
  const family = layer.fontFamily || "sans-serif";
  const fontFamily = family.includes(",") ? family : `"${family}"`;
  const font = `${fontSize}px ${fontFamily}`;

  const prevFont = ctx.font;
  ctx.font = font;
  const lines = wrapTextLines(ctx, layer.content ?? "", maxWidth ?? null);
  let width = 0;
  for (const line of lines) {
    width = Math.max(width, ctx.measureText(line).width);
  }
  const lineHeight = fontSize;
  const height = lineHeight * (lines.length || 1);
  ctx.font = prevFont;

  return {
    lines,
    width: width + strokeWidth * 2,
    height: height + strokeWidth * 2,
    lineHeight,
    font,
  };
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number | null,
): string[] {
  const rawLines = text.split(/\r?\n/);
  if (!maxWidth || maxWidth <= 0) return rawLines;

  const lines: string[] = [];

  for (const raw of rawLines) {
    const words = raw.split(" ");
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
        continue;
      }

      lines.push(line);
      line = word;

      if (ctx.measureText(line).width > maxWidth) {
        const split = splitLongWord(ctx, line, maxWidth);
        lines.push(...split.slice(0, -1));
        line = split[split.length - 1] ?? "";
      }
    }

    if (line) lines.push(line);
    if (!line && raw === "") lines.push("");
  }

  return lines.length ? lines : [""];
}

function splitLongWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
): string[] {
  const parts: string[] = [];
  let current = "";
  for (const ch of word) {
    const candidate = current + ch;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    parts.push(current);
    current = ch;
  }
  if (current) parts.push(current);
  return parts;
}

async function ensureFontsLoaded(
  layers: NonNullable<CoverCropState["textLayers"]>,
): Promise<void> {
  if (!layers?.length) return;
  const fonts = (document as any)?.fonts as FontFaceSet | undefined;
  if (!fonts?.load) return;

  const families = new Set<string>();
  for (const layer of layers) {
    const family = extractPrimaryFontFamily(layer?.fontFamily);
    if (family) families.add(family);
  }
  if (!families.size) return;

  const loads = Array.from(families, (family) =>
    fonts.load(`16px "${family}"`).catch(() => null),
  );
  await Promise.allSettled(loads);
}

function extractPrimaryFontFamily(value?: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  if (!first) return null;
  return first.replace(/^['"]|['"]$/g, "");
}
