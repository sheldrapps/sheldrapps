import { Injectable } from '@angular/core';
import type { KindleModel } from '../components/kindle-model-picker/kindle-model-picker.component';

export type ImageValidationError = 'TYPE' | 'SIZE' | 'CORRUPT';

@Injectable({ providedIn: 'root' })
export class ImagePipelineService {
  readonly allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
  readonly maxBytes = 20 * 1024 * 1024;

  readonly workingMaxSide = 2048;
  readonly workingJpegQuality = 0.85;

  validateBasic(file: File): ImageValidationError | null {
    const type = (file.type || '').toLowerCase();

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp']);

    const okByMime = type && this.allowedMime.has(type);
    const okByExt = allowedExt.has(ext);

    if (!okByMime && !okByExt) return 'TYPE';
    if (file.size <= 0 || file.size > this.maxBytes) return 'SIZE';
    return null;
  }

  async getDimensions(
    file: File,
  ): Promise<{ width: number; height: number } | null> {
    try {
      const bmp = await createImageBitmap(file);
      try {
        const w = bmp.width;
        const h = bmp.height;
        return w && h ? { width: w, height: h } : null;
      } finally {
        bmp.close?.();
      }
    } catch {}

    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
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

  async normalizeFile(file: File): Promise<File | null> {
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

  async prepareWorkingImage(file: File): Promise<File> {
    let bitmap: ImageBitmap;

    try {
      bitmap = await createImageBitmap(file);
    } catch (err) {
      console.error('[pipe] createImageBitmap failed', err, {
        name: file.name,
        type: file.type,
        size: file.size,
      });
      return file;
    }

    try {
      const srcW = bitmap.width;
      const srcH = bitmap.height;

      const maxSide = Math.max(srcW, srcH);

      const minSide = 1024;
      let scale = 1;

      if (maxSide > this.workingMaxSide) {
        scale = this.workingMaxSide / maxSide;
      } else if (maxSide < minSide) {
        scale = minSide / maxSide;
      }

      const outW = Math.max(1, Math.round(srcW * scale));
      const outH = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return file;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, outW, outH);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', this.workingJpegQuality),
      );
      if (!blob) return file;

      const baseName = file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '');
      return new File([blob], `${baseName}_working.jpg`, {
        type: 'image/jpeg',
      });
    } finally {
      bitmap.close?.();
    }
  }

  getSmallWarnParams(
    originalDims: { width: number; height: number },
    model: KindleModel,
  ) {
    const minW = Math.min(model.width, model.height);
    const minH = Math.max(model.width, model.height);

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

  async materializeFile(file: File): Promise<File> {
    const ab = await file.arrayBuffer();
    const type = (file.type || 'image/jpeg').toLowerCase();
    const name = file.name || `image_${Date.now()}.jpg`;
    return new File([ab], name, { type });
  }
}
