export interface DitherPreviewAnalysis {
  isDithered: boolean;
  width: number;
  height: number;
  monochromeScore: number;
  binaryRatio: number;
  transitionRatio: number;
}

export interface OptimizedPreviewResult {
  dataUrl: string;
  width: number;
  height: number;
}

const DEFAULT_SAMPLE_MAX_SIDE = 160;
const DEFAULT_OPTIMIZED_MAX_SIDE = 1600;

export async function analyzeDitherPreview(
  src: string,
  sampleMaxSide = DEFAULT_SAMPLE_MAX_SIDE,
): Promise<DitherPreviewAnalysis | null> {
  const image = await loadImage(src);
  if (!image) {
    return null;
  }

  const fitted = fitWithinBounds(
    image.width,
    image.height,
    sampleMaxSide,
    sampleMaxSide,
  );
  const canvas = document.createElement('canvas');
  canvas.width = fitted.width;
  canvas.height = fitted.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, fitted.width, fitted.height);

  const { data } = context.getImageData(0, 0, fitted.width, fitted.height);
  if (!data.length) {
    return null;
  }

  const pixelCount = fitted.width * fitted.height;
  let monochromeAccumulator = 0;
  let binaryCount = 0;
  let transitionCount = 0;
  let transitionPairs = 0;
  const luminance = new Uint8ClampedArray(pixelCount);

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const channelSpread =
      Math.abs(red - green) + Math.abs(green - blue) + Math.abs(red - blue);

    monochromeAccumulator += channelSpread / 3;

    const lum = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue);
    luminance[index] = lum;

    if (lum <= 40 || lum >= 215) {
      binaryCount += 1;
    }
  }

  for (let y = 0; y < fitted.height; y += 1) {
    for (let x = 0; x < fitted.width; x += 1) {
      const index = y * fitted.width + x;
      const current = luminance[index];

      if (x + 1 < fitted.width) {
        transitionPairs += 1;
        if (Math.abs(current - luminance[index + 1]) >= 120) {
          transitionCount += 1;
        }
      }

      if (y + 1 < fitted.height) {
        transitionPairs += 1;
        if (Math.abs(current - luminance[index + fitted.width]) >= 120) {
          transitionCount += 1;
        }
      }
    }
  }

  const monochromeScore = monochromeAccumulator / pixelCount;
  const binaryRatio = binaryCount / pixelCount;
  const transitionRatio = transitionPairs
    ? transitionCount / transitionPairs
    : 0;
  const isDithered =
    monochromeScore <= 20 && binaryRatio >= 0.82 && transitionRatio >= 0.18;

  return {
    isDithered,
    width: image.width,
    height: image.height,
    monochromeScore,
    binaryRatio,
    transitionRatio,
  };
}

export async function buildOptimizedPreviewDataUrl(
  src: string,
  options?: {
    maxSide?: number;
    preserveHardEdges?: boolean;
    keepSourceResolution?: boolean;
    reDitherFromLossySource?: boolean;
    mimeType?: string;
    quality?: number;
  },
): Promise<OptimizedPreviewResult | null> {
  const image = await loadImage(src);
  if (!image) {
    return null;
  }

  const maxSide = options?.maxSide ?? DEFAULT_OPTIMIZED_MAX_SIDE;
  const keepSourceResolution = options?.keepSourceResolution ?? false;
  const fitted = keepSourceResolution
    ? { width: image.width, height: image.height }
    : fitWithinBounds(image.width, image.height, maxSide, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = fitted.width;
  canvas.height = fitted.height;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const preserveHardEdges = options?.preserveHardEdges ?? false;
  context.imageSmoothingEnabled = !preserveHardEdges;
  if (!preserveHardEdges) {
    context.imageSmoothingQuality = 'high';
  }
  context.drawImage(image, 0, 0, fitted.width, fitted.height);

  if (options?.reDitherFromLossySource) {
    restoreBinaryFromLossyMonochrome(context, fitted.width, fitted.height);
  }

  const mimeType = options?.mimeType ?? 'image/png';
  const dataUrl = canvas.toDataURL(mimeType, options?.quality);

  return {
    dataUrl,
    width: image.width,
    height: image.height,
  };
}

function restoreBinaryFromLossyMonochrome(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imgData = context.getImageData(0, 0, width, height);
  const data = imgData.data;
  const gray = new Float32Array(width * height);
  const blurred = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const i = idx * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[idx] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
  }

  // Light 3x3 blur reduces JPEG ringing/speckle before binarization.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        const ny = y + oy;
        if (ny < 0 || ny >= height) continue;
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox;
          if (nx < 0 || nx >= width) continue;
          sum += gray[ny * width + nx];
          count += 1;
        }
      }
      blurred[y * width + x] = count ? sum / count : gray[y * width + x];
    }
  }

  const histogram = new Uint32Array(256);
  for (let i = 0; i < blurred.length; i += 1) {
    const v = Math.max(0, Math.min(255, Math.round(blurred[i])));
    histogram[v] += 1;
  }

  const threshold = computeOtsuThreshold(histogram, blurred.length);

  for (let i = 0; i < blurred.length; i += 1) {
    const value = blurred[i] < threshold ? 0 : 255;
    const px = i * 4;
    data[px] = value;
    data[px + 1] = value;
    data[px + 2] = value;
    data[px + 3] = 255;
  }

  context.putImageData(imgData, 0, 0);
}

function computeOtsuThreshold(
  histogram: Uint32Array,
  totalPixels: number,
): number {
  if (!totalPixels) {
    return 128;
  }

  let sumAll = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    sumAll += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = -1;
  let bestThreshold = 128;

  for (let t = 0; t < histogram.length; t += 1) {
    weightBackground += histogram[t];
    if (!weightBackground) continue;

    const weightForeground = totalPixels - weightBackground;
    if (!weightForeground) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumAll - sumBackground) / weightForeground;
    const betweenVariance =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) *
      (meanBackground - meanForeground);

    if (betweenVariance > maxVariance) {
      maxVariance = betweenVariance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}

function fitWithinBounds(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (!width || !height) {
    return { width: 1, height: 1 };
  }

  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
