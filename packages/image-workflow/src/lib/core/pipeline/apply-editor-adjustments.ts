import type {
  ArtifactReductionMode,
  CleanupStrength,
  CoverCropState,
  DitheringSettings,
  ImageCleanupSettings,
} from "../../types";
import {
  resolveCleanupArtifactReductionMode,
  resolveOutputProcessingSettings,
} from "./output-processing-state";

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const ORDERED_COLOR_LUMA_STEP = 4;
const ORDERED_COLOR_CHROMA_STEP = 6;
const BW_ORDERED_STRENGTH = 26;
const COLOR_FLOYD_STEP = 14;

type CleanupPreset = {
  blurRadius: number;
  lumaBlend: number;
  chromaBlend: number;
  edgeThreshold: number;
  debandRadius: number;
  debandThreshold: number;
  debandBlend: number;
  debandPasses: number;
  grainAmount: number;
};

const CLEANUP_PRESETS: Record<Exclude<CleanupStrength, "off">, CleanupPreset> = {
  light: {
    blurRadius: 1,
    lumaBlend: 0.12,
    chromaBlend: 0.24,
    edgeThreshold: 20,
    debandRadius: 4,
    debandThreshold: 18,
    debandBlend: 0.2,
    debandPasses: 1,
    grainAmount: 0.45,
  },
  balanced: {
    blurRadius: 2,
    lumaBlend: 0.2,
    chromaBlend: 0.34,
    edgeThreshold: 24,
    debandRadius: 7,
    debandThreshold: 22,
    debandBlend: 0.34,
    debandPasses: 2,
    grainAmount: 0.8,
  },
  strong: {
    blurRadius: 3,
    lumaBlend: 0.28,
    chromaBlend: 0.44,
    edgeThreshold: 28,
    debandRadius: 10,
    debandThreshold: 26,
    debandBlend: 0.46,
    debandPasses: 3,
    grainAmount: 1.15,
  },
};

export function applyEditorAdjustments(
  imageData: ImageData,
  state: CoverCropState,
  artifactReductionMode: ArtifactReductionMode = resolveCleanupArtifactReductionMode(
    state,
  ),
): void {
  const { data, width, height } = imageData;
  if (!width || !height || !data.length) return;

  const processing = resolveOutputProcessingSettings(state);
  const debug = shouldDebugPipeline();
  const cleanupStart = debug ? now() : 0;

  if (processing.cleanup.enabled && artifactReductionMode !== "none") {
    applyCleanupStage(data, width, height, processing.cleanup);
  }

  if (debug && processing.cleanup.enabled) {
    console.debug("[EDITOR_CLEANUP]", {
      width,
      height,
      enabled: processing.cleanup.enabled,
      artifactReduction: processing.cleanup.artifactReduction,
      smoothGradients: processing.cleanup.smoothGradients,
      preserveDetails: processing.cleanup.preserveDetails,
      durationMs: roundDuration(now() - cleanupStart),
    });
  }

  const brightness = state.brightness;
  const saturation = state.saturation;
  const contrast = state.contrast;
  const sharpness = clampSharpness(state.sharpness ?? 0);

  if (!state.bw) {
    applyColorAdjustments(data, brightness, saturation, contrast);
    if (sharpness > 0) {
      applyLightUnsharpMask(data, width, height, sharpness);
    }
    if (processing.dithering.enabled) {
      applyColorDithering(data, width, height, processing.dithering);
    }
    return;
  }

  if (sharpness > 0) {
    applyLightUnsharpMask(data, width, height, sharpness);
  }

  applyBwAdjustments(
    data,
    width,
    height,
    brightness,
    contrast,
    processing.dithering,
  );

}

function clampSharpness(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function applyCleanupStage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cleanup: ImageCleanupSettings,
): void {
  const strength = cleanup.artifactReduction;
  const preset =
    CLEANUP_PRESETS[strength === "off" ? "light" : strength] ??
    CLEANUP_PRESETS.balanced;

  if (strength !== "off") {
    applyEdgePreservingCleanup(data, width, height, preset, cleanup.preserveDetails);
  }

  if (cleanup.smoothGradients) {
    applyDeBanding(
      data,
      width,
      height,
      preset,
      cleanup.preserveDetails,
    );
  }
}

function applyEdgePreservingCleanup(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  preset: CleanupPreset,
  preserveDetails: boolean,
): void {
  const blurred = separableBoxBlur(data, width, height, preset.blurRadius);
  const originalLuma = buildLuminanceBuffer(data, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const edgeStrength = computeLumaEdgeStrength(originalLuma, width, height, x, y);
      const edgeMask = preserveDetails
        ? clamp01(1 - edgeStrength / preset.edgeThreshold)
        : 1;
      if (edgeMask <= 0.03) continue;

      const offset = idx * 4;
      const original = rgbToYcbcr(
        data[offset],
        data[offset + 1],
        data[offset + 2],
      );
      const softened = rgbToYcbcr(
        blurred[offset],
        blurred[offset + 1],
        blurred[offset + 2],
      );

      const next = ycbcrToRgb(
        mix(original.y, softened.y, preset.lumaBlend * edgeMask),
        mix(original.cb, softened.cb, preset.chromaBlend * edgeMask),
        mix(original.cr, softened.cr, preset.chromaBlend * edgeMask),
      );

      data[offset] = next.r;
      data[offset + 1] = next.g;
      data[offset + 2] = next.b;
    }
  }
}

function separableBoxBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const temp = new Float32Array(data.length);
  const out = new Uint8ClampedArray(data.length);
  const win = 2 * radius + 1;

  for (let y = 0; y < height; y += 1) {
    const rowBase = y * width;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    for (let dx = -radius; dx <= radius; dx += 1) {
      const xi = Math.max(0, Math.min(width - 1, dx));
      const ni = (rowBase + xi) * 4;
      sumR += data[ni];
      sumG += data[ni + 1];
      sumB += data[ni + 2];
    }

    for (let x = 0; x < width; x += 1) {
      const idx = (rowBase + x) * 4;
      temp[idx] = sumR / win;
      temp[idx + 1] = sumG / win;
      temp[idx + 2] = sumB / win;

      const xl = Math.max(0, x - radius);
      const xr = Math.min(width - 1, x + radius + 1);
      const li = (rowBase + xl) * 4;
      const ri = (rowBase + xr) * 4;
      sumR += data[ri] - data[li];
      sumG += data[ri + 1] - data[li + 1];
      sumB += data[ri + 2] - data[li + 2];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    for (let dy = -radius; dy <= radius; dy += 1) {
      const yi = Math.max(0, Math.min(height - 1, dy));
      const ni = (yi * width + x) * 4;
      sumR += temp[ni];
      sumG += temp[ni + 1];
      sumB += temp[ni + 2];
    }

    for (let y = 0; y < height; y += 1) {
      const idx = (y * width + x) * 4;
      out[idx] = sumR / win;
      out[idx + 1] = sumG / win;
      out[idx + 2] = sumB / win;
      out[idx + 3] = data[idx + 3];

      const yt = Math.max(0, y - radius);
      const yb = Math.min(height - 1, y + radius + 1);
      const ti = (yt * width + x) * 4;
      const bi = (yb * width + x) * 4;
      sumR += temp[bi] - temp[ti];
      sumG += temp[bi + 1] - temp[ti + 1];
      sumB += temp[bi + 2] - temp[ti + 2];
    }
  }

  return out;
}

function applyDeBanding(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  preset: CleanupPreset,
  preserveDetails: boolean,
): void {
  let working = new Uint8ClampedArray(data);

  for (let pass = 0; pass < preset.debandPasses; pass += 1) {
    const radius = preset.debandRadius + pass * 2;
    const blurred = separableBoxBlur(working, width, height, radius);
    const luminance = buildLuminanceBuffer(working, width, height);
    const next = new Uint8ClampedArray(working);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        const offset = idx * 4;
        const edgeStrength = computeLumaEdgeStrength(
          luminance,
          width,
          height,
          x,
          y,
        );
        const localRange = computeLocalLumaRange(luminance, width, height, x, y, 1);
        const flatness = resolveFlatness({
          edgeStrength,
          localRange,
          threshold: preset.debandThreshold,
          preserveDetails,
        });
        if (flatness <= 0.04) continue;

        const original = rgbToYcbcr(
          working[offset],
          working[offset + 1],
          working[offset + 2],
        );
        const softened = rgbToYcbcr(
          blurred[offset],
          blurred[offset + 1],
          blurred[offset + 2],
        );
        const lumaDelta = Math.abs(original.y - softened.y);
        const deltaMask = clamp01(
          1 - lumaDelta / (preset.debandThreshold * 1.8),
        );
        if (deltaMask <= 0.03) continue;

        const blend = preset.debandBlend * flatness * deltaMask;
        const nextColor = ycbcrToRgb(
          mix(original.y, softened.y, blend),
          mix(original.cb, softened.cb, blend * 0.35),
          mix(original.cr, softened.cr, blend * 0.35),
        );

        next[offset] = nextColor.r;
        next[offset + 1] = nextColor.g;
        next[offset + 2] = nextColor.b;
      }
    }

    working = next;
  }

  if (preset.grainAmount > 0) {
    applyFlatRegionGrain(
      working,
      width,
      height,
      preset.debandThreshold,
      preset.grainAmount,
      preserveDetails,
    );
  }

  data.set(working);
}

export function applyAdaptiveColorArtifactReduction(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity = 1,
): void {
  if (!width || !height || !data.length) return;

  const luminance = buildLuminanceBuffer(data, width, height);
  const normalizedIntensity = resolveDitherIntensity(intensity);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const edgeStrength = computeLumaEdgeStrength(luminance, width, height, x, y);
      const flatness = clamp01(1 - edgeStrength / 18);
      if (flatness <= 0.04) continue;

      const offset = idx * 4;
      const original = rgbToYcbcr(
        data[offset],
        data[offset + 1],
        data[offset + 2],
      );

      const dither = ((BAYER_4X4[y & 3][x & 3] + 0.5) / 16 - 0.5) * normalizedIntensity;
      const chromaDither =
        ((BAYER_4X4[x & 3][y & 3] + 0.5) / 16 - 0.5) * normalizedIntensity;
      const quantized = {
        y: quantizeChannel(
          original.y + dither * ORDERED_COLOR_LUMA_STEP * flatness,
          ORDERED_COLOR_LUMA_STEP,
        ),
        cb: quantizeChannel(
          original.cb + chromaDither * ORDERED_COLOR_CHROMA_STEP * flatness,
          ORDERED_COLOR_CHROMA_STEP,
        ),
        cr: quantizeChannel(
          original.cr - chromaDither * ORDERED_COLOR_CHROMA_STEP * flatness,
          ORDERED_COLOR_CHROMA_STEP,
        ),
      };

      const next = ycbcrToRgb(
        mix(original.y, quantized.y, 0.7 * flatness),
        mix(original.cb, quantized.cb, 0.48 * flatness),
        mix(original.cr, quantized.cr, 0.48 * flatness),
      );
      data[offset] = next.r;
      data[offset + 1] = next.g;
      data[offset + 2] = next.b;
    }
  }
}

function applyColorAdjustments(
  data: Uint8ClampedArray,
  brightness: number,
  saturation: number,
  contrast: number,
): void {
  for (let i = 0; i < data.length; i += 4) {
    let red = data[i];
    let green = data[i + 1];
    let blue = data[i + 2];

    red = (red - 128) * contrast + 128;
    green = (green - 128) * contrast + 128;
    blue = (blue - 128) * contrast + 128;

    red *= brightness;
    green *= brightness;
    blue *= brightness;

    const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    red = luma + (red - luma) * saturation;
    green = luma + (green - luma) * saturation;
    blue = luma + (blue - luma) * saturation;

    data[i] = clampByte(red);
    data[i + 1] = clampByte(green);
    data[i + 2] = clampByte(blue);
  }
}

function applyColorDithering(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  dithering: DitheringSettings,
): void {
  if (!dithering.enabled || dithering.mode === "none") {
    return;
  }

  if (dithering.mode === "ordered") {
    applyAdaptiveColorArtifactReduction(
      data,
      width,
      height,
      dithering.intensity ?? 1,
    );
    return;
  }

  applyColorErrorDiffusion(data, width, height, dithering.intensity);
}

function applyColorErrorDiffusion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity?: number,
): void {
  const work = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    work[i] = data[i];
  }

  const step = Math.max(
    4,
    Math.round(COLOR_FLOYD_STEP / Math.max(resolveDitherIntensity(intensity), 0.35)),
  );

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const oldValue = work[offset + channel];
        const newValue = quantizeChannel(oldValue, step);
        const error = oldValue - newValue;
        work[offset + channel] = newValue;
        diffuseChannelError(work, width, height, x, y, channel, error);
      }

      data[offset] = clampByte(work[offset]);
      data[offset + 1] = clampByte(work[offset + 1]);
      data[offset + 2] = clampByte(work[offset + 2]);
    }
  }
}

function applyBwAdjustments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  brightness: number,
  contrast: number,
  dithering: DitheringSettings,
): void {
  const gray = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      let red = data[offset];
      let green = data[offset + 1];
      let blue = data[offset + 2];

      red = (red - 128) * contrast + 128;
      green = (green - 128) * contrast + 128;
      blue = (blue - 128) * contrast + 128;

      red *= brightness;
      green *= brightness;
      blue *= brightness;

      gray[y * width + x] = clampByte(
        0.2126 * red + 0.7152 * green + 0.0722 * blue,
      );
    }
  }

  if (dithering.enabled && dithering.mode !== "none") {
    if (dithering.mode === "ordered") {
      applyOrderedBwDither(gray, width, height, dithering.intensity);
    } else {
      applyBwDither(gray, width, height);
    }
  }

  for (let i = 0; i < gray.length; i += 1) {
    const value = clampByte(gray[i]);
    const offset = i * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
  }
}

function applyLightUnsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): void {
  if (!width || !height || amount <= 0) return;
  const gain = amount * 1.8;
  const blurred = separableBoxBlur(data, width, height, 1);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte(data[i] + (data[i] - blurred[i]) * gain);
    data[i + 1] = clampByte(
      data[i + 1] + (data[i + 1] - blurred[i + 1]) * gain,
    );
    data[i + 2] = clampByte(
      data[i + 2] + (data[i + 2] - blurred[i + 2]) * gain,
    );
  }
}

function applyBwDither(
  gray: Float32Array,
  width: number,
  height: number,
): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const oldVal = gray[idx];
      const newVal = oldVal < 128 ? 0 : 255;
      const err = oldVal - newVal;
      gray[idx] = newVal;

      if (x + 1 < width) gray[idx + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) gray[idx + width - 1] += (err * 3) / 16;
        gray[idx + width] += (err * 5) / 16;
        if (x + 1 < width) gray[idx + width + 1] += err / 16;
      }
    }
  }
}

function applyOrderedBwDither(
  gray: Float32Array,
  width: number,
  height: number,
  intensity?: number,
): void {
  const strength = BW_ORDERED_STRENGTH * resolveDitherIntensity(intensity);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const threshold = ((BAYER_4X4[y & 3][x & 3] + 0.5) / 16 - 0.5) * strength;
      gray[idx] = gray[idx] + threshold < 128 ? 0 : 255;
    }
  }
}

function buildLuminanceBuffer(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const luminance = new Float32Array(width * height);
  for (let i = 0, px = 0; i < data.length; i += 4, px += 1) {
    luminance[px] =
      0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return luminance;
}

function computeLumaEdgeStrength(
  luminance: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const idx = y * width + x;
  const current = luminance[idx];

  let horizontal = 0;
  if (x > 0) horizontal = Math.max(horizontal, Math.abs(current - luminance[idx - 1]));
  if (x + 1 < width) {
    horizontal = Math.max(horizontal, Math.abs(current - luminance[idx + 1]));
  }

  let vertical = 0;
  if (y > 0) vertical = Math.max(vertical, Math.abs(current - luminance[idx - width]));
  if (y + 1 < height) {
    vertical = Math.max(vertical, Math.abs(current - luminance[idx + width]));
  }

  return Math.max(horizontal, vertical);
}

function computeLocalLumaRange(
  luminance: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let dy = -radius; dy <= radius; dy += 1) {
    const yi = Math.max(0, Math.min(height - 1, y + dy));
    for (let dx = -radius; dx <= radius; dx += 1) {
      const xi = Math.max(0, Math.min(width - 1, x + dx));
      const value = luminance[yi * width + xi];
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  return max - min;
}

function resolveFlatness(args: {
  edgeStrength: number;
  localRange: number;
  threshold: number;
  preserveDetails: boolean;
}): number {
  const { edgeStrength, localRange, threshold, preserveDetails } = args;
  const edgeMask = preserveDetails ? clamp01(1 - edgeStrength / threshold) : 1;
  const rangeMask = clamp01(1 - localRange / (threshold * 1.3));
  return edgeMask * rangeMask;
}

function applyFlatRegionGrain(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
  grainAmount: number,
  preserveDetails: boolean,
): void {
  const luminance = buildLuminanceBuffer(data, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const offset = idx * 4;
      const edgeStrength = computeLumaEdgeStrength(
        luminance,
        width,
        height,
        x,
        y,
      );
      const localRange = computeLocalLumaRange(luminance, width, height, x, y, 1);
      const flatness = resolveFlatness({
        edgeStrength,
        localRange,
        threshold,
        preserveDetails,
      });
      if (flatness <= 0.12) continue;

      const original = rgbToYcbcr(
        data[offset],
        data[offset + 1],
        data[offset + 2],
      );
      const noise = (hashNoise(x, y) - 0.5) * 2;
      const next = ycbcrToRgb(
        original.y + noise * grainAmount * flatness,
        original.cb,
        original.cr,
      );

      data[offset] = next.r;
      data[offset + 1] = next.g;
      data[offset + 2] = next.b;
    }
  }
}

function hashNoise(x: number, y: number): number {
  const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return seed - Math.floor(seed);
}

function diffuseChannelError(
  work: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  channel: number,
  error: number,
): void {
  if (x + 1 < width) {
    work[(y * width + (x + 1)) * 4 + channel] += (error * 7) / 16;
  }

  if (y + 1 >= height) {
    return;
  }

  if (x > 0) {
    work[((y + 1) * width + (x - 1)) * 4 + channel] += (error * 3) / 16;
  }
  work[((y + 1) * width + x) * 4 + channel] += (error * 5) / 16;
  if (x + 1 < width) {
    work[((y + 1) * width + (x + 1)) * 4 + channel] += error / 16;
  }
}

function rgbToYcbcr(red: number, green: number, blue: number) {
  return {
    y: 0.299 * red + 0.587 * green + 0.114 * blue,
    cb: 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue,
    cr: 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue,
  };
}

function ycbcrToRgb(y: number, cb: number, cr: number) {
  return {
    r: clampByte(y + 1.402 * (cr - 128)),
    g: clampByte(y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128)),
    b: clampByte(y + 1.772 * (cb - 128)),
  };
}

function resolveDitherIntensity(value?: number): number {
  if (!Number.isFinite(value)) return 1;
  return clamp01(value as number);
}

function quantizeChannel(value: number, step: number): number {
  if (!Number.isFinite(value) || step <= 0) return value;
  return clampByte(Math.round(value / step) * step);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampByte(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * clamp01(amount);
}

function shouldDebugPipeline(): boolean {
  return !!(globalThis as { ngDevMode?: unknown }).ngDevMode;
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function roundDuration(value: number): number {
  return Math.round(value * 100) / 100;
}
