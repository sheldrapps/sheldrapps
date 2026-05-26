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
import { PdfRewriteService } from './pdf-rewrite.service';
import { FileService } from './file.service';

type ExtractCandidateImagesParams = {
  pdfFile?: File;
  pdfNativePath?: string;
  pdfName?: string;
  maxImages?: number;
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
    const maxImages = Math.max(1, params.maxImages ?? Number.MAX_SAFE_INTEGER);
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
    const hints: BestCandidateHint[] = ['near-book-start', 'first-large-image'];
    const images: BestCandidateImage[] = [
      {
        id: 'first-page-render#1',
        src,
        sourcePath: firstPage.sourcePath,
        fileName: firstPage.file.name,
        width: dims.width,
        height: dims.height,
        mimeType: firstPage.file.type || 'image/png',
        sizeBytes: firstPage.file.size,
        index: 0,
        hints,
        metadata: { file: firstPage.file },
      },
    ].slice(0, maxImages);

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
          maxDimension: 1600,
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
}
