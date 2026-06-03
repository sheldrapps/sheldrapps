import type {
  BackgroundMode,
  BackgroundSource,
  CoverCropState,
  CropTarget,
  FitBackgroundConfig,
} from "../../types";
import { getBackgroundAssetPath } from "../../types";
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
  includeBackground?: boolean;
  includeTextLayers?: boolean;
  debug?: boolean;
  debugLabel?: string;
}

type RasterSource = ImageBitmap | HTMLImageElement;

const DEFAULT_EXPORT_QUALITY = 0.92;
const DEFAULT_EXPORT_MIME = "image/jpeg";
const DEFAULT_EXPORT_MIME_TRANSPARENT = "image/png";
const DEFAULT_BACKGROUND = "#000000";
const DEFAULT_BLUR_STRENGTH = 80;
const MAX_BLUR_PX = 40;
const DEFAULT_BACKGROUND_INTENSITY = 1;
const DEFAULT_BACKGROUND_SCALE = 1;
const MIN_BACKGROUND_SCALE = 0.25;
const MAX_BACKGROUND_SCALE = 4;
const TEXT_STAGE_EDGE_PAD = 15;
const TEXT_HANDLE_PAD_RIGHT = 12;
const EREADER_UPSCALE_MIN_SHORT_SIDE = 1100;
const EREADER_UPSCALE_MAX_FACTOR = 1.6;

const backgroundImageCache = new Map<string, Promise<HTMLImageElement | null>>();
const backgroundTileCache = new Map<string, Promise<HTMLCanvasElement | null>>();

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
  const baseOutputSize = resolveCompositionOutputSize({
    target,
    frameWidth,
    frameHeight,
    baseScale,
    naturalWidth,
    naturalHeight,
    state,
    outputScale,
  });
  if (!baseOutputSize) return null;

  const eReaderUpscaleFactor = resolveEReaderUpscaleFactor({
    mode: options.mode,
    target,
    state,
    width: baseOutputSize.width,
    height: baseOutputSize.height,
  });
  const outputSize =
    eReaderUpscaleFactor > 1
      ? {
          width: Math.max(1, Math.round(baseOutputSize.width * eReaderUpscaleFactor)),
          height: Math.max(
            1,
            Math.round(baseOutputSize.height * eReaderUpscaleFactor),
          ),
        }
      : baseOutputSize;

  const layoutW = outputSize.width;
  const layoutH = outputSize.height;

  const scaledW = layoutW;
  const scaledH = layoutH;

  const dispScale = baseScale * state.scale;
  if (!Number.isFinite(dispScale) || dispScale <= 0) return null;

  const frameScale = scaledW / frameWidth;

  const bitmap = await resolveRasterSource({
    file,
    sourceBitmap,
    sourceBitmapPromise,
  });

  const backgroundMode =
    (state.backgroundMode ?? "transparent") as BackgroundMode;
  const backgroundColor =
    state.backgroundColor?.trim() || DEFAULT_BACKGROUND;
  const backgroundSource =
    (state.backgroundSource ?? "same-image") as BackgroundSource;
  const backgroundBlur =
    Number.isFinite(state.backgroundBlur) ? state.backgroundBlur! : DEFAULT_BLUR_STRENGTH;
  const backgroundPattern = state.backgroundPattern ?? state.backgroundTexture;

  const canvas = document.createElement("canvas");
  canvas.width = scaledW;
  canvas.height = scaledH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const shouldDrawCheckerAfter = previewMode && backgroundMode === "transparent";
  const includeBackground = options.includeBackground !== false;

  if (includeBackground) {
    await drawBackground(ctx, {
      mode: backgroundMode,
      color: backgroundColor,
      source: backgroundSource,
      blur: backgroundBlur,
      background: backgroundPattern,
      bitmap,
      width: scaledW,
      height: scaledH,
      preview: previewMode,
      fallbackColor: options.backgroundFallbackColor,
      deferCheckerboard: shouldDrawCheckerAfter,
    });
  }

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

  const textLayers = options.includeTextLayers === false
    ? []
    : Array.isArray(state.textLayers)
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

  applyAdjustments(ctx, scaledW, scaledH, state);

  if (includeBackground && shouldDrawCheckerAfter) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    drawCheckerboard(ctx, scaledW, scaledH);
    ctx.restore();
  }
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

function resolveEReaderUpscaleFactor(args: {
  mode: CompositionRenderMode;
  target: CropTarget;
  state: CoverCropState;
  width: number;
  height: number;
}): number {
  const { mode, target, state, width, height } = args;
  if (mode !== "export") return 1;
  if (!state.eReaderOptimizationEnabled) return 1;
  if ((target.output ?? "target") !== "source") return 1;

  const shortSide = Math.min(width, height);
  if (!Number.isFinite(shortSide) || shortSide <= 0) return 1;
  if (shortSide >= EREADER_UPSCALE_MIN_SHORT_SIDE) return 1;

  const factor = EREADER_UPSCALE_MIN_SHORT_SIDE / shortSide;
  return Math.max(1, Math.min(EREADER_UPSCALE_MAX_FACTOR, factor));
}

async function drawBackground(
  ctx: CanvasRenderingContext2D,
  opts: {
    mode: BackgroundMode;
    color: string;
    source: BackgroundSource;
    blur: number;
    background?: FitBackgroundConfig;
    bitmap: RasterSource;
    width: number;
    height: number;
    preview: boolean;
    fallbackColor?: string;
    deferCheckerboard?: boolean;
  },
): Promise<void> {
  const {
    mode,
    color,
    source,
    blur,
    background,
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

  if (mode === "background" || mode === "texture") {
    ctx.fillStyle = color || fallbackColor || DEFAULT_BACKGROUND;
    ctx.fillRect(0, 0, width, height);
    const normalizedBackground = normalizeBackground(background);
    const pattern = await resolveBackgroundPattern(ctx, normalizedBackground);
    if (!pattern) return;
    const offsetX = normalizedBackground?.offsetX ?? 0;
    const offsetY = normalizedBackground?.offsetY ?? 0;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(offsetX, offsetY);
    ctx.fillStyle = pattern;
    ctx.fillRect(-offsetX, -offsetY, width, height);
    ctx.restore();
    return;
  }

  if (mode === "blur" && source === "same-image") {
    ctx.save();
    ctx.fillStyle = fallbackColor || DEFAULT_BACKGROUND;
    ctx.fillRect(0, 0, width, height);
    const clamped = Math.max(0, Math.min(100, blur));
    const blurPx = (clamped / 100) * MAX_BLUR_PX;
    ctx.filter = `blur(${blurPx}px)`;

    const bitmapWidth = getRasterWidth(bitmap);
    const bitmapHeight = getRasterHeight(bitmap);
    const scale = Math.max(width / bitmapWidth, height / bitmapHeight);
    const bw = bitmapWidth * scale;
    const bh = bitmapHeight * scale;
    const bx = (width - bw) / 2;
    const by = (height - bh) / 2;

    ctx.drawImage(bitmap, bx, by, bw, bh);
    ctx.restore();
  }
}

async function resolveRasterSource(args: {
  file: File;
  sourceBitmap?: ImageBitmap;
  sourceBitmapPromise?: Promise<ImageBitmap>;
}): Promise<RasterSource> {
  const { file, sourceBitmap, sourceBitmapPromise } = args;
  if (sourceBitmap) return sourceBitmap;
  if (sourceBitmapPromise) {
    try {
      return await sourceBitmapPromise;
    } catch {
      // Fallback below.
    }
  }

  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fallback below.
    }
  }

  return loadImageElementFromFile(file);
}

function loadImageElementFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    img.src = url;
  });
}

function getRasterWidth(source: RasterSource): number {
  return source instanceof ImageBitmap
    ? source.width
    : source.naturalWidth || source.width;
}

function getRasterHeight(source: RasterSource): number {
  return source instanceof ImageBitmap
    ? source.height
    : source.naturalHeight || source.height;
}

async function resolveBackgroundPattern(
  ctx: CanvasRenderingContext2D,
  background?: FitBackgroundConfig,
): Promise<CanvasPattern | null> {
  const normalized = normalizeBackground(background);
  if (!normalized) return null;
  const tile = await resolveBackgroundTile(normalized);
  if (!tile) return null;
  return ctx.createPattern(tile, "repeat");
}

async function resolveBackgroundTile(
  background: FitBackgroundConfig,
): Promise<HTMLCanvasElement | null> {
  const assetPath = getBackgroundAssetPath(background);
  const scale = normalizeBackgroundScale(background.scale);
  const cacheKey = `${assetPath}|${scale}`;
  const cached = backgroundTileCache.get(cacheKey);
  if (cached) return cached;

  const next = (async () => {
    const image = await resolveBackgroundImage(assetPath);
    if (!image) return null;
    const sourceWidth = Math.max(1, image.naturalWidth || image.width);
    const sourceHeight = Math.max(1, image.naturalHeight || image.height);
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas;
  })();

  backgroundTileCache.set(cacheKey, next);
  return next;
}

async function resolveBackgroundImage(path: string): Promise<HTMLImageElement | null> {
  const cached = backgroundImageCache.get(path);
  if (cached) return cached;

  const next = loadImageElementFromUrl(path).catch(() => null);
  backgroundImageCache.set(path, next);
  return next;
}

function loadImageElementFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
    img.src = url;
  });
}

function normalizeBackground(
  background?: FitBackgroundConfig,
): FitBackgroundConfig | undefined {
  if (!background) return undefined;
  const textureId = (background.textureId || "").trim();
  const file = (background.file || "").trim();
  if (!textureId || !file) return undefined;
  return {
    textureId,
    file,
    intensity: normalizeBackgroundIntensity(background.intensity),
    scale: normalizeBackgroundScale(background.scale),
    offsetX: normalizeBackgroundOffset(background.offsetX),
    offsetY: normalizeBackgroundOffset(background.offsetY),
  };
}

function normalizeBackgroundIntensity(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_BACKGROUND_INTENSITY;
  return Math.max(0, Math.min(1, value as number));
}

function normalizeBackgroundScale(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_BACKGROUND_SCALE;
  return Math.max(MIN_BACKGROUND_SCALE, Math.min(MAX_BACKGROUND_SCALE, value as number));
}

function normalizeBackgroundOffset(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return value as number;
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
