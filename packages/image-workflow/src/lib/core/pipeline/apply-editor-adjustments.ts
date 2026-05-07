import type { ArtifactReductionMode, CoverCropState } from "../../types";

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const COLOR_EDGE_THRESHOLD = 18;
const COLOR_BLEND_STRENGTH = 0.82;
const COLOR_CHROMA_BLEND = 0.58;
const COLOR_LUMA_STEP = 4;
const COLOR_CHROMA_STEP = 6;

export function applyEditorAdjustments(
  imageData: ImageData,
  state: CoverCropState,
  artifactReductionMode: ArtifactReductionMode,
): void {
  const { data, width, height } = imageData;
  if (!width || !height || !data.length) return;

  const brightness = state.brightness;
  const saturation = state.saturation;
  const contrast = state.contrast;

  if (!state.bw) {
    applyColorAdjustments(data, brightness, saturation, contrast);
    if (artifactReductionMode === "adaptive-color") {
      applyAdaptiveColorArtifactReduction(data, width, height);
    }
    return;
  }

  applyBwAdjustments(
    data,
    width,
    height,
    brightness,
    contrast,
    artifactReductionMode,
  );
}

export function applyAdaptiveColorArtifactReduction(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  if (!width || !height || !data.length) return;

  const luminance = new Float32Array(width * height);

  for (let i = 0, px = 0; i < data.length; i += 4, px += 1) {
    luminance[px] =
      0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const edgeStrength = computeLumaEdgeStrength(luminance, width, height, x, y);
      const flatness = clamp01(1 - edgeStrength / COLOR_EDGE_THRESHOLD);
      if (flatness <= 0.04) continue;

      const offset = idx * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];

      const luma = 0.299 * red + 0.587 * green + 0.114 * blue;
      const cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
      const cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;

      const dither = (BAYER_4X4[y & 3][x & 3] + 0.5) / 16 - 0.5;
      const chromaDither = (BAYER_4X4[x & 3][y & 3] + 0.5) / 16 - 0.5;
      const lumaNoise = dither * COLOR_LUMA_STEP * flatness;
      const cbNoise = chromaDither * COLOR_CHROMA_STEP * flatness;
      const crNoise = -chromaDither * COLOR_CHROMA_STEP * flatness;

      const quantizedLuma = quantizeChannel(luma + lumaNoise, COLOR_LUMA_STEP);
      const quantizedCb = quantizeChannel(cb + cbNoise, COLOR_CHROMA_STEP);
      const quantizedCr = quantizeChannel(cr + crNoise, COLOR_CHROMA_STEP);

      const blend = COLOR_BLEND_STRENGTH * flatness;
      const blendedLuma = mix(luma, quantizedLuma, blend);
      const blendedCb = mix(cb, quantizedCb, blend * COLOR_CHROMA_BLEND);
      const blendedCr = mix(cr, quantizedCr, blend * COLOR_CHROMA_BLEND);

      data[offset] = clampByte(
        blendedLuma + 1.402 * (blendedCr - 128),
      );
      data[offset + 1] = clampByte(
        blendedLuma -
          0.344136 * (blendedCb - 128) -
          0.714136 * (blendedCr - 128),
      );
      data[offset + 2] = clampByte(
        blendedLuma + 1.772 * (blendedCb - 128),
      );
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

function applyBwAdjustments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  brightness: number,
  contrast: number,
  artifactReductionMode: ArtifactReductionMode,
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

  if (artifactReductionMode === "bw-dither") {
    applyBwDither(gray, width, height);
  }

  for (let i = 0; i < gray.length; i += 1) {
    const value = clampByte(gray[i]);
    const offset = i * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
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
