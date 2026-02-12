import type {
  ImageValidationError,
  ValidationResult,
  ImageValidationOptions,
  ImageDims,
  WorkingImageOptions,
  SmallImageWarnParams,
  CropTarget,
} from '../../types';

/**
 * Default validation options
 */
export const DEFAULT_VALIDATION_OPTIONS: ImageValidationOptions = {
  maxBytes: 20 * 1024 * 1024, // 20MB
  allowedMimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
  allowedExtensions: new Set(['jpg', 'jpeg', 'png', 'webp']),
};

/**
 * Default working image options
 */
export const DEFAULT_WORKING_OPTIONS: WorkingImageOptions = {
  maxSide: 2048,
  minSide: 1024,
  quality: 0.85,
  mimeType: 'image/jpeg',
  allowUpscale: false,
};

/**
 * Validates basic file properties (type and size)
 */
export function validateBasic(
  file: File,
  options: Partial<ImageValidationOptions> = {}
): ImageValidationError | null {
  const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };

  const type = (file.type || '').toLowerCase();
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  const okByMime = type && opts.allowedMimeTypes.has(type);
  const okByExt = opts.allowedExtensions?.has(ext);

  if (!okByMime && !okByExt) return 'UNSUPPORTED_TYPE';
  if (file.size <= 0 || file.size > opts.maxBytes) return 'TOO_LARGE';

  return null;
}

/**
 * Gets image dimensions from a File or Blob
 * Tries createImageBitmap first, falls back to HTMLImageElement
 */
export async function getDimensions(
  source: File | Blob
): Promise<ImageDims | null> {
  // 1) Prefer: createImageBitmap (more reliable on Android)
  try {
    const bmp = await createImageBitmap(source);
    try {
      const w = bmp.width;
      const h = bmp.height;
      return w && h ? { width: w, height: h } : null;
    } finally {
      bmp.close?.();
    }
  } catch {
    // fallback below
  }

  // 2) Fallback: HTMLImageElement (objectURL)
  return new Promise((resolve) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    const t = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 6000);

    img.onload = () => {
      clearTimeout(t);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve(width && height ? { width, height } : null);
    };

    img.onerror = () => {
      clearTimeout(t);
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Normalizes a file by reading it into memory and creating a new File
 * Useful for fixing corrupted metadata or lazy-loaded files
 */
export async function normalizeFile(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arr = reader.result as ArrayBuffer;
      const type = (file.type || 'image/jpeg').toLowerCase();
      const baseName = file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '');
      resolve(new File([arr], `${baseName}_normalized`, { type }));
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Materializes a File to ensure it's fully loaded in memory
 */
export async function materializeFile(file: File): Promise<File> {
  const ab = await file.arrayBuffer();
  const type = (file.type || 'image/jpeg').toLowerCase();
  const name = file.name || `image_${Date.now()}.jpg`;
  return new File([ab], name, { type });
}

/**
 * Prepares a working image by resizing and optimizing
 * Scales down if too large, scales up if too small (optional)
 */
export async function prepareWorkingImage(
  source: File | Blob,
  options: Partial<WorkingImageOptions> = {}
): Promise<File> {
  const opts = { ...DEFAULT_WORKING_OPTIONS, ...options };

  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(source);
  } catch (err) {
    // Return as-is if can't process
    if (source instanceof File) return source;
    const name = `image_${Date.now()}.jpg`;
    return new File([source], name, { type: opts.mimeType });
  }

  try {
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const maxSide = Math.max(srcW, srcH);

    let scale = 1;

    if (maxSide > opts.maxSide) {
      scale = opts.maxSide / maxSide;
    } else if (opts.minSide && maxSide < opts.minSide) {
      if (opts.allowUpscale) {
        scale = opts.minSide / maxSide;
      }
    }

    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      if (source instanceof File) return source;
      const name = `image_${Date.now()}.jpg`;
      return new File([source], name, { type: opts.mimeType });
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, outW, outH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), opts.mimeType, opts.quality)
    );

    if (!blob) {
      if (source instanceof File) return source;
      const name = `image_${Date.now()}.jpg`;
      return new File([source], name, { type: opts.mimeType });
    }

    const baseName =
      source instanceof File
        ? source.name.replace(/\.(png|jpg|jpeg|webp)$/i, '')
        : `image_${Date.now()}`;

    const ext = opts.mimeType === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `${baseName}_working.${ext}`, {
      type: opts.mimeType,
    });
  } finally {
    bitmap.close?.();
  }
}

/**
 * Checks if an image is too small for a target size and returns warning parameters
 */
export function getSmallWarnParams(
  originalDims: ImageDims,
  target: CropTarget
): SmallImageWarnParams | null {
  const minW = Math.min(target.width, target.height);
  const minH = Math.max(target.width, target.height);

  const w = Math.min(originalDims.width, originalDims.height);
  const h = Math.max(originalDims.width, originalDims.height);

  if (w >= minW && h >= minH) return null;

  return {
    imgW: originalDims.width,
    imgH: originalDims.height,
    minW,
    minH,
  };
}
