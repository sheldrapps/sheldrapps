import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  BestCandidateHint,
  BestCandidateImage,
} from '@sheldrapps/best-candidate-kit';
import {
  WEB_PDF_COVER_SERVICE_TOKEN,
  type WebPdfCoverService,
} from '@sheldrapps/file-kit/pdf';
import { FileService } from './file.service';
import { PdfRewriteService } from './pdf-rewrite.service';

const PDF_PREVIEW_MAX_DIMENSION = 1600;
const DEFAULT_PAGE_CANDIDATE_LIMIT = 8;

type ExtractCandidateImagesParams = {
  pdfFile?: File;
  pdfNativePath?: string;
  pdfName?: string;
  maxImages?: number;
};

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
  destroy?: () => Promise<void>;
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy?: () => Promise<void>;
};

type PdfJsObjectStore = {
  get: (objId: string, callback?: (data: unknown) => void) => unknown;
  has?: (objId: string) => boolean;
};

type PdfJsPage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  getOperatorList: (params?: {
    intent?: 'display' | 'print';
    annotationMode?: number;
    printAnnotationStorage?: unknown;
    isEditing?: boolean;
  }) => Promise<PdfJsOperatorList>;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
  cleanup?: () => void;
  objs: PdfJsObjectStore;
  commonObjs: PdfJsObjectStore;
};

type PdfJsOperatorList = {
  fnArray: number[];
  argsArray: unknown[][];
};

type PdfJsLib = {
  getDocument: (src: { data: Uint8Array; disableWorker: boolean }) => PdfJsLoadingTask;
  OPS: {
    paintImageXObject: number;
    paintInlineImageXObject: number;
    paintImageXObjectRepeat: number;
    paintInlineImageXObjectGroup: number;
  };
  ImageKind: {
    GRAYSCALE_1BPP: number;
    RGB_24BPP: number;
    RGBA_32BPP: number;
  };
};

type PdfDocumentHandle = {
  loadingTask: PdfJsLoadingTask;
  document: PdfJsDocument;
  pdfjs: PdfJsLib;
};

type RenderedCandidate = {
  file: File;
  width: number;
  height: number;
};

type PdfJsImageData = {
  width: number;
  height: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: ImageBitmap | HTMLCanvasElement | HTMLImageElement;
  kind?: number;
  interpolate?: boolean;
};

export type CandidateDiscoveryRejection = {
  path: string;
  reason: string;
};

export type CandidateDiscoveryDiagnostics = {
  manifestImageCount: number;
  zipImageCount: number;
  mergedImageCount: number;
  candidatesAfterFilters: number;
  rejectedImages: CandidateDiscoveryRejection[];
};

export type CandidateDiscoveryResult = {
  images: BestCandidateImage[];
  diagnostics: CandidateDiscoveryDiagnostics;
};

export type StrictCoverResolution = {
  file: File;
  sourcePath: string;
};

export type FirstPageDimensionsRequest = {
  pdfFile?: File;
  pdfNativePath?: string;
  pdfName?: string;
};

@Injectable({ providedIn: 'root' })
export class PdfCandidateImageService {
  private readonly pdfRewrite = inject(PdfRewriteService);
  private readonly fileService = inject(FileService);
  private readonly webPdfCover = inject(WEB_PDF_COVER_SERVICE_TOKEN, {
    optional: true,
  }) as WebPdfCoverService | null;

  async extractCandidateImages(
    params: ExtractCandidateImagesParams,
  ): Promise<BestCandidateImage[]> {
    const discovered = await this.discoverInternalImages(params);
    return discovered.images;
  }

  async discoverInternalImages(
    params: ExtractCandidateImagesParams,
  ): Promise<CandidateDiscoveryResult> {
    const rejections: CandidateDiscoveryRejection[] = [];
    const maxImages = Math.max(
      1,
      Math.min(
        params.maxImages ?? DEFAULT_PAGE_CANDIDATE_LIMIT,
        DEFAULT_PAGE_CANDIDATE_LIMIT,
      ),
    );
    const images: BestCandidateImage[] = [];

    const pdfBytes = await this.loadPdfBytes(params);
    if (pdfBytes) {
      const handle = await this.loadPdfDocument(pdfBytes);
      if (handle) {
        try {
          const embeddedImages = await this.collectEmbeddedImageCandidates(
            handle,
            params.pdfName || 'pdf',
            maxImages,
            rejections,
          );
          images.push(...embeddedImages);
          if (images.length > 0) {
            return {
              images: images.slice(0, maxImages),
              diagnostics: {
                manifestImageCount: embeddedImages.length,
                zipImageCount: 0,
                mergedImageCount: images.length,
                candidatesAfterFilters: images.length,
                rejectedImages: rejections,
              },
            };
          }
        } catch (error) {
          console.warn('[PCM_BEST_CANDIDATE] embedded image scan failed', error);
          rejections.push({
            path: 'embedded-image-scan',
            reason: 'preview-unavailable',
          });
        } finally {
          try {
            await handle.document.destroy?.();
          } catch {
            // best effort
          }
          try {
            await handle.loadingTask.destroy?.();
          } catch {
            // best effort
          }
        }
      }
    }

    if (!images.length) {
      const firstPage = await this.resolveStrictCover(params);
      if (!firstPage) {
        rejections.push({
          path: 'first-page-render',
          reason: 'preview-unavailable',
        });
        return {
          images: [],
          diagnostics: {
            manifestImageCount: 0,
            zipImageCount: 0,
            mergedImageCount: 0,
            candidatesAfterFilters: 0,
            rejectedImages: rejections,
          },
        };
      }

      const dims = await this.readImageDimensions(firstPage.file);
      if (!dims) {
        rejections.push({
          path: 'first-page-render',
          reason: 'unreadable-image',
        });
        return {
          images: [],
          diagnostics: {
            manifestImageCount: 0,
            zipImageCount: 0,
            mergedImageCount: 0,
            candidatesAfterFilters: 0,
            rejectedImages: rejections,
          },
        };
      }

      const src = URL.createObjectURL(firstPage.file);
      images.push({
        id: 'first-page-render#1',
        src,
        sourcePath: firstPage.sourcePath,
        fileName: firstPage.file.name,
        width: dims.width,
        height: dims.height,
        mimeType: firstPage.file.type || 'image/png',
        sizeBytes: firstPage.file.size,
        index: 0,
        hints: ['near-book-start', 'first-large-image'],
        metadata: { file: firstPage.file },
      });
    }

    return {
      images,
      diagnostics: {
        manifestImageCount: 0,
        zipImageCount: 0,
        mergedImageCount: images.length,
        candidatesAfterFilters: images.length,
        rejectedImages: rejections,
      },
    };
  }

  async resolveStrictCover(
    params: ExtractCandidateImagesParams,
  ): Promise<StrictCoverResolution | null> {
    if (params.pdfNativePath && this.pdfRewrite.isSupported()) {
      try {
        const extracted = await this.pdfRewrite.extractFirstPagePreviewFile({
          inputPath: params.pdfNativePath,
          pdfName: params.pdfName || 'pdf',
          maxDimension: PDF_PREVIEW_MAX_DIMENSION,
        });
        return {
          file: extracted.file,
          sourcePath: 'first-page-render',
        };
      } catch {
        const nativeWebFallback = await this.extractFromNativePathUsingWebRenderer(
          params.pdfNativePath,
          params.pdfName,
        );
        if (nativeWebFallback) {
          return {
            file: nativeWebFallback,
            sourcePath: 'first-page-render',
          };
        }
      }
    }

    if (params.pdfFile) {
      const extracted = await this.fileService.extractCoverFromPdfFile(
        params.pdfFile,
      );
      if (extracted) {
        return {
          file: extracted,
          sourcePath: 'first-page-render',
        };
      }

      const forcedWebFallback = await this.extractUsingWebRenderer(
        params.pdfFile,
      );
      if (forcedWebFallback) {
        return {
          file: forcedWebFallback,
          sourcePath: 'first-page-render',
        };
      }

      console.warn(
        '[PCM_WEB_PDF_FALLBACK] strict cover extraction returned null',
      );
    }

    return null;
  }

  async getFirstPageDimensions(
    params: FirstPageDimensionsRequest,
  ): Promise<{ width: number; height: number } | null> {
    const pdfBytes = await this.loadPdfBytes(params);
    if (!pdfBytes) {
      return null;
    }

    const handle = await this.loadPdfDocument(pdfBytes);
    if (!handle) {
      return null;
    }

    try {
      if (!handle.document || handle.document.numPages < 1) {
        return null;
      }

      const page = await handle.document.getPage(1);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const width = Math.round(viewport.width);
        const height = Math.round(viewport.height);
        if (!width || !height) {
          return null;
        }

        return { width, height };
      } finally {
        try {
          page.cleanup?.();
        } catch {
          // best effort
        }
      }
    } finally {
      try {
        await handle.document.destroy?.();
      } catch {
        // best effort
      }
      try {
        await handle.loadingTask.destroy?.();
      } catch {
        // best effort
      }
    }
  }

  private async loadPdfBytes(
    params: ExtractCandidateImagesParams,
  ): Promise<Uint8Array | null> {
    if (params.pdfFile) {
      try {
        return new Uint8Array(await params.pdfFile.arrayBuffer());
      } catch {
        return null;
      }
    }

    if (!params.pdfNativePath) {
      return null;
    }

    try {
      const fileUri = params.pdfNativePath.startsWith('file://')
        ? params.pdfNativePath
        : `file://${params.pdfNativePath}`;
      const url = Capacitor.convertFileSrc(fileUri);
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  private async loadPdfDocument(
    bytes: Uint8Array,
  ): Promise<PdfDocumentHandle | null> {
    let loadingTask: PdfJsLoadingTask | null = null;
    try {
      const pdfjs = await this.loadPdfJs();
      loadingTask = pdfjs.getDocument({ data: bytes, disableWorker: true });
      const document = await loadingTask.promise;
      return { loadingTask, document, pdfjs };
    } catch {
      try {
        await loadingTask?.destroy?.();
      } catch {
        // best effort
      }
      return null;
    }
  }

  private async loadPdfJs(): Promise<PdfJsLib> {
    const module = await import('pdfjs-dist');
    const lib = this.resolvePdfJsLib(module);
    if (!lib) {
      throw new Error('PDFJS_LOAD_FAILED');
    }

    return lib;
  }

  private resolvePdfJsLib(module: unknown): PdfJsLib | null {
    if (!module || typeof module !== 'object') {
      return null;
    }

    const direct = module as { getDocument?: unknown };
    if (typeof direct.getDocument === 'function') {
      return direct as unknown as PdfJsLib;
    }

    const nestedDefault = module as { default?: { getDocument?: unknown } };
    if (
      nestedDefault.default &&
      typeof nestedDefault.default.getDocument === 'function'
    ) {
      return nestedDefault.default as unknown as PdfJsLib;
    }

    return null;
  }

  private async renderPdfPageToFile(
    page: PdfJsPage,
    pdfName: string,
    pageNumber: number,
  ): Promise<RenderedCandidate | null> {
    try {
      const baseViewport = page.getViewport({ scale: 1 });
      const longestSide = Math.max(baseViewport.width, baseViewport.height);
      const scale =
        longestSide > PDF_PREVIEW_MAX_DIMENSION
          ? PDF_PREVIEW_MAX_DIMENSION / longestSide
          : 1;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const blob = await this.canvasToPngBlob(canvas);
      if (!blob) {
        return null;
      }

      const fileName = `${this.sanitizeBaseName(pdfName)}_page${pageNumber}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      return {
        file,
        width: canvas.width,
        height: canvas.height,
      };
    } catch {
      return null;
    } finally {
      try {
        page.cleanup?.();
      } catch {
        // best effort
      }
    }
  }

  private async collectEmbeddedImageCandidates(
    handle: PdfDocumentHandle,
    pdfName: string,
    maxImages: number,
    rejections: CandidateDiscoveryRejection[],
  ): Promise<BestCandidateImage[]> {
    const images: BestCandidateImage[] = [];
    const seenObjectIds = new Set<string>();
    const pageLimit = Math.min(handle.document.numPages || 0, maxImages);

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      if (images.length >= maxImages) {
        break;
      }

      let page: PdfJsPage | null = null;
      try {
        page = await handle.document.getPage(pageNumber);
        const operatorList = await page.getOperatorList({ intent: 'display' });
        for (let index = 0; index < operatorList.fnArray.length; index += 1) {
          if (images.length >= maxImages) {
            break;
          }

          const op = operatorList.fnArray[index];
          if (!this.isImageOperator(op, handle.pdfjs.OPS)) {
            continue;
          }

          const candidate = await this.extractImageCandidateFromOperator(
            page,
            operatorList.argsArray[index],
            handle.pdfjs,
            pdfName,
            pageNumber,
            index,
            seenObjectIds,
          );
          if (candidate) {
            images.push(candidate);
          }
        }
      } catch (error) {
        console.warn(
          `[PCM_BEST_CANDIDATE] embedded image scan failed for page ${pageNumber}`,
          error,
        );
        rejections.push({
          path: `pdf-page-${pageNumber}`,
          reason: 'preview-unavailable',
        });
      } finally {
        try {
          page?.cleanup?.();
        } catch {
          // best effort
        }
      }
    }

    return images;
  }

  private isImageOperator(op: number, ops: PdfJsLib['OPS']): boolean {
    return (
      op === ops.paintImageXObject ||
      op === ops.paintInlineImageXObject ||
      op === ops.paintImageXObjectRepeat ||
      op === ops.paintInlineImageXObjectGroup
    );
  }

  private async extractImageCandidateFromOperator(
    page: PdfJsPage,
    operatorArgs: unknown[],
    pdfjs: PdfJsLib,
    pdfName: string,
    pageNumber: number,
    opIndex: number,
    seenObjectIds: Set<string>,
  ): Promise<BestCandidateImage | null> {
    const raw = operatorArgs?.[0];
    const imageData = await this.resolveImageData(page, raw);
    if (!imageData) {
      return null;
    }

    const objectId = typeof raw === 'string' ? raw : undefined;
    if (objectId) {
      if (seenObjectIds.has(objectId)) {
        return null;
      }
      seenObjectIds.add(objectId);
    }

    const blob = await this.imageDataToBlob(imageData, pdfjs);
    if (!blob) {
      return null;
    }

    const baseName = this.sanitizeBaseName(pdfName);
    const file = new File([blob], `${baseName}_image_p${pageNumber}_${opIndex + 1}.png`, {
      type: 'image/png',
    });

    return {
      id: objectId || `pdf-page-${pageNumber}-image-${opIndex + 1}`,
      src: URL.createObjectURL(file),
      sourcePath: objectId || `pdf-page-${pageNumber}-image-${opIndex + 1}`,
      fileName: file.name,
      width: imageData.width,
      height: imageData.height,
      mimeType: file.type,
      sizeBytes: file.size,
      index: pageNumber - 1,
      hints:
        pageNumber === 1
          ? (['near-book-start', 'first-large-image'] as BestCandidateHint[])
          : pageNumber <= 3
            ? (['near-book-start'] as BestCandidateHint[])
            : undefined,
      metadata: {
        file,
        pageNumber,
        source: 'embedded-image',
        objectId,
      },
    };
  }

  private async resolveImageData(
    page: PdfJsPage,
    raw: unknown,
  ): Promise<PdfJsImageData | null> {
    if (raw && typeof raw === 'object' && 'width' in raw && 'height' in raw) {
      return raw as PdfJsImageData;
    }

    if (typeof raw !== 'string') {
      return null;
    }

    const resolved = await this.waitForPdfObject(page.objs, raw);
    if (resolved) {
      return resolved as PdfJsImageData;
    }

    const commonResolved = await this.waitForPdfObject(page.commonObjs, raw);
    if (commonResolved) {
      return commonResolved as PdfJsImageData;
    }

    return null;
  }

  private waitForPdfObject(
    store: PdfJsObjectStore,
    objId: string,
  ): Promise<unknown | null> {
    return new Promise((resolve) => {
      try {
        const immediate = store.get(objId, (data: unknown) => {
          resolve(data ?? null);
        });
        if (typeof immediate !== 'undefined') {
          resolve(immediate ?? null);
        }
      } catch {
        resolve(null);
      }
    });
  }

  private async imageDataToBlob(
    imageData: PdfJsImageData,
    pdfjs: PdfJsLib,
  ): Promise<Blob | null> {
    if (imageData.bitmap) {
      return this.drawImageSourceToBlob(imageData.bitmap);
    }

    if (!imageData.data || !imageData.width || !imageData.height) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    const imageKind = imageData.kind ?? pdfjs.ImageKind.RGBA_32BPP;
    if (imageKind === pdfjs.ImageKind.GRAYSCALE_1BPP) {
      const rgba = this.expandGrayscale1Bpp(
        imageData.data,
        imageData.width,
        imageData.height,
      );
      if (!rgba) {
        return null;
      }
      const imageBuffer = new Uint8ClampedArray(rgba);
      ctx.putImageData(
        new ImageData(imageBuffer, imageData.width, imageData.height),
        0,
        0,
      );
      return this.canvasToPngBlob(canvas);
    }

    if (imageKind === pdfjs.ImageKind.RGB_24BPP) {
      const rgba = this.expandRgbToRgba(
        imageData.data,
        imageData.width,
        imageData.height,
      );
      if (!rgba) {
        return null;
      }
      const imageBuffer = new Uint8ClampedArray(rgba);
      ctx.putImageData(
        new ImageData(imageBuffer, imageData.width, imageData.height),
        0,
        0,
      );
      return this.canvasToPngBlob(canvas);
    }

    const rgba =
      imageData.data instanceof Uint8ClampedArray
        ? imageData.data
        : new Uint8ClampedArray(
            imageData.data.buffer.slice(
              imageData.data.byteOffset,
              imageData.data.byteOffset + imageData.data.byteLength,
            ),
          );
    const imageBuffer = new Uint8ClampedArray(rgba);
    ctx.putImageData(
      new ImageData(imageBuffer, imageData.width, imageData.height),
      0,
      0,
    );
    return this.canvasToPngBlob(canvas);
  }

  private async drawImageSourceToBlob(
    source: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
  ): Promise<Blob | null> {
    const width = source.width;
    const height = source.height;
    if (!width || !height) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(source, 0, 0);
    return this.canvasToPngBlob(canvas);
  }

  private expandRgbToRgba(
    data: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
  ): Uint8ClampedArray | null {
    const expected = width * height * 3;
    if (data.byteLength < expected) {
      return null;
    }

    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let src = 0, dest = 0; dest < rgba.length; src += 3, dest += 4) {
      rgba[dest] = data[src] ?? 0;
      rgba[dest + 1] = data[src + 1] ?? 0;
      rgba[dest + 2] = data[src + 2] ?? 0;
      rgba[dest + 3] = 255;
    }
    return rgba;
  }

  private expandGrayscale1Bpp(
    data: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
  ): Uint8ClampedArray | null {
    const bytesPerRow = Math.ceil(width / 8);
    const expected = bytesPerRow * height;
    if (data.byteLength < expected) {
      return null;
    }

    const rgba = new Uint8ClampedArray(width * height * 4);
    let srcOffset = 0;
    let destOffset = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const byte = data[srcOffset + (x >> 3)] ?? 0;
        const bit = 7 - (x & 7);
        const on = (byte >> bit) & 1;
        const value = on ? 0 : 255;
        rgba[destOffset] = value;
        rgba[destOffset + 1] = value;
        rgba[destOffset + 2] = value;
        rgba[destOffset + 3] = 255;
        destOffset += 4;
      }
      srcOffset += bytesPerRow;
    }
    return rgba;
  }

  private async extractFromNativePathUsingWebRenderer(
    nativePath: string,
    pdfName?: string,
  ): Promise<File | null> {
    if (!this.webPdfCover) {
      return null;
    }

    try {
      const fileUri = nativePath.startsWith('file://')
        ? nativePath
        : `file://${nativePath}`;
      const url = Capacitor.convertFileSrc(fileUri);
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      const sourceFile = new File([blob], pdfName || 'pdf', {
        type: blob.type || 'application/pdf',
      });
      return await this.extractUsingWebRenderer(sourceFile);
    } catch {
      return null;
    }
  }

  private async extractUsingWebRenderer(file: File): Promise<File | null> {
    if (!this.webPdfCover) {
      return null;
    }

    try {
      return await this.webPdfCover.extractCover(file);
    } catch {
      return null;
    }
  }

  private async readImageDimensions(
    file: File,
  ): Promise<{ width: number; height: number } | null> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const dims = await new Promise<{ width: number; height: number } | null>(
        (resolve) => {
          const image = new Image();
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => resolve(null);
          image.src = objectUrl;
        },
      );
      return dims;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private async canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/png'),
    );
    if (blob) {
      return blob;
    }

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1] || '';
      if (!base64) {
        return null;
      }

      const bytes = this.base64ToBytes(base64);
      const strict = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      return new Blob([strict], { type: 'image/png' });
    } catch {
      return null;
    }
  }

  private base64ToBytes(data: string): Uint8Array {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private sanitizeBaseName(name: string): string {
    return (name || 'pdf')
      .replace(/\.pdf$/i, '')
      .replace(/[^\w.-]/g, '_');
  }
}
