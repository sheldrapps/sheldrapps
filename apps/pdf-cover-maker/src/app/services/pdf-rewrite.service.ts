import { Injectable } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import {
  Capacitor,
  registerPlugin,
  type Plugin,
  type PluginListenerHandle,
} from '@capacitor/core';
import type {
  PdfInspectionResult,
  PdfRewriteNativeErrorCode,
} from './pdf-contracts';

type RewriteProgressEvent = {
  percent: number;
};

type PickAndPreparePdfOptions = {
  maxBytes?: number;
};

type PickAndPreparePdfResult = {
  success: boolean;
  selectedName?: string;
  sourceSize?: number;
  sourceLastModified?: number;
  sourceMimeType?: string;
  workingPath?: string;
  workingName?: string;
  workingNativePath?: string;
  outputBaseName?: string;
  error?: PdfRewriteNativeErrorCode | string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
};

type InspectPdfResult = {
  success: boolean;
  valid?: boolean;
  encrypted?: boolean;
  passwordProtected?: boolean;
  pageCount?: number;
  fileSizeBytes?: number;
  title?: string;
  author?: string;
  pageDimensions?: Array<{
    pageNumber: number;
    widthPt: number;
    heightPt: number;
    sourcePageBox: 'crop-box' | 'media-box';
  }>;
  error?: PdfRewriteNativeErrorCode | string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
};

type RewriteCoverOptions = {
  inputPath: string;
  outputPath?: string;
  newCoverPath: string;
  mode?: 'replace' | 'insert';
  pageWidthPt?: number;
  pageHeightPt?: number;
};

type RewriteCoverResult = {
  success: boolean;
  outputPath?: string;
  error?: PdfRewriteNativeErrorCode | string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
};

type CreatePdfFromCoverOptions = {
  outputPath: string;
  coverPath: string;
  title?: string;
  lang?: string;
  appName?: string;
  pageWidthPt?: number;
  pageHeightPt?: number;
};

type CreatePdfFromCoverResult = {
  success: boolean;
  error?: PdfRewriteNativeErrorCode | string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
};

type ExtractFirstPagePreviewOptions = {
  inputPath: string;
  maxDimension?: number;
};

type ExtractFirstPagePreviewResult = {
  success: boolean;
  tempImagePath?: string;
  tempImageRelativePath?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  error?: PdfRewriteNativeErrorCode | string;
  message?: string;
  stage?: string;
};

type OpenExternalFileOptions = {
  inputPath: string;
  mimeType?: string;
  chooserTitle?: string;
};

type OpenExternalFileResult = {
  success: boolean;
  error?: PdfRewriteNativeErrorCode | string;
  message?: string;
  stage?: string;
};

type PdfRewritePlugin = Plugin & {
  listPublicDocuments(options: { folderName: string }): Promise<{ success: boolean; files?: Array<{ name: string; uri: string; size: number }>; error?: string; message?: string; stage?: string }>;
  getPublicDocument(options: { folderName: string; filename: string }): Promise<{ success: boolean; uri?: string; filename?: string; size?: number; error?: string; message?: string; stage?: string }>;
  renamePublicDocument(options: { folderName: string; filename: string; outputName: string }): Promise<{ success: boolean; uri?: string; filename?: string; size?: number; error?: string; message?: string; stage?: string }>;
  publishPublicDocument(options: { folderName: string; sourcePath: string; outputName: string; mimeType: string }): Promise<{ success: boolean; uri?: string; filename?: string; size?: number; error?: string; message?: string; stage?: string }>;
  pickAndPreparePdf(
    options: PickAndPreparePdfOptions,
  ): Promise<PickAndPreparePdfResult>;
  inspectPdf(options: { inputPath: string }): Promise<InspectPdfResult>;
  rewriteCover(options: RewriteCoverOptions): Promise<RewriteCoverResult>;
  createPdfFromCover(
    options: CreatePdfFromCoverOptions,
  ): Promise<CreatePdfFromCoverResult>;
  extractFirstPagePreview(
    options: ExtractFirstPagePreviewOptions,
  ): Promise<ExtractFirstPagePreviewResult>;
  openExternalFile(
    options: OpenExternalFileOptions,
  ): Promise<OpenExternalFileResult>;
  cancelRewrite(): Promise<{ cancelled: boolean }>;
};

const PdfRewrite = registerPlugin<PdfRewritePlugin>('PdfRewritePlugin');

export class PdfRewriteError extends Error {
  constructor(
    readonly code: string,
    readonly details?: {
      message?: string;
      stage?: string;
      requiredBytes?: number;
      availableBytes?: number;
    },
  ) {
    super(details?.message ? `${code}: ${details.message}` : code);
    this.name = 'PdfRewriteError';
  }
}

@Injectable({ providedIn: 'root' })
export class PdfRewriteService {
  isSupported(): boolean {
    return (
      Capacitor.getPlatform() === 'android' &&
      Capacitor.isPluginAvailable('PdfRewritePlugin')
    );
  }

  async publishPublicDocument(options: { folderName: string; sourcePath: string; outputName: string; mimeType: string }): Promise<{ uri: string; filename: string; size: number }> {
    const result = await PdfRewrite.publishPublicDocument(options);
    if (!result.success || !result.uri || !result.filename || typeof result.size !== 'number') throw new PdfRewriteError(result.error ?? 'PUBLIC_EXPORT_FAILED', { message: result.message, stage: result.stage });
    return { uri: result.uri, filename: result.filename, size: result.size };
  }

  async getPublicDocument(folderName: string, filename: string): Promise<{ uri: string; filename: string; size: number }> {
    const result = await PdfRewrite.getPublicDocument({ folderName, filename });
    if (!result.success || !result.uri || !result.filename || typeof result.size !== 'number') throw new PdfRewriteError(result.error ?? 'PUBLIC_DOCUMENT_NOT_FOUND', { message: result.message, stage: result.stage });
    return { uri: result.uri, filename: result.filename, size: result.size };
  }

  async renamePublicDocument(
    folderName: string,
    filename: string,
    outputName: string,
  ): Promise<{ uri: string; filename: string; size: number }> {
    const result = await PdfRewrite.renamePublicDocument({
      folderName,
      filename,
      outputName,
    });
    if (
      !result.success ||
      !result.uri ||
      !result.filename ||
      typeof result.size !== 'number'
    ) {
      throw new PdfRewriteError(result.error ?? 'PUBLIC_RENAME_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
    return { uri: result.uri, filename: result.filename, size: result.size };
  }

  async listPublicDocuments(folderName: string): Promise<readonly { name: string; uri: string; size: number }[]> {
    const result = await PdfRewrite.listPublicDocuments({ folderName });
    if (!result.success) throw new PdfRewriteError(result.error ?? 'PUBLIC_LIST_FAILED', { message: result.message, stage: result.stage });
    return result.files ?? [];
  }

  addProgressListener(
    listener: (event: RewriteProgressEvent) => void,
  ): Promise<PluginListenerHandle> {
    return PdfRewrite.addListener('rewriteProgress', listener);
  }

  async pickAndPreparePdf(options: PickAndPreparePdfOptions): Promise<{
    selectedName: string;
    sourceSize: number;
    sourceLastModified: number;
    sourceMimeType: string;
    workingPath: string;
    workingName: string;
    workingNativePath: string;
    outputBaseName: string;
  }> {
    const result = await PdfRewrite.pickAndPreparePdf(options);
    if (
      !result.success ||
      !result.workingPath ||
      !result.workingName ||
      !result.workingNativePath ||
      !result.outputBaseName
    ) {
      throw new PdfRewriteError(result.error ?? 'REWRITE_FAILED', {
        message: result.message,
        stage: result.stage,
        requiredBytes: result.requiredBytes,
        availableBytes: result.availableBytes,
      });
    }

    return {
      selectedName: result.selectedName || result.workingName,
      sourceSize: result.sourceSize ?? 0,
      sourceLastModified: result.sourceLastModified ?? Date.now(),
      sourceMimeType: result.sourceMimeType || 'application/pdf',
      workingPath: result.workingPath,
      workingName: result.workingName,
      workingNativePath: result.workingNativePath,
      outputBaseName: result.outputBaseName,
    };
  }

  async inspectPdf(inputPath: string): Promise<PdfInspectionResult> {
    const result = await PdfRewrite.inspectPdf({ inputPath });
    return {
      valid: !!(result.success && (result.valid ?? true)),
      encrypted: !!result.encrypted,
      passwordProtected: !!result.passwordProtected,
      pageCount: result.pageCount,
      fileSizeBytes: result.fileSizeBytes,
      title: result.title,
      author: result.author,
      pageDimensions: result.pageDimensions,
      errorCode: result.error as PdfRewriteNativeErrorCode | undefined,
    };
  }

  async getPageDimensions(inputPath: string): Promise<
    Array<{
      pageNumber: number;
      widthPt: number;
      heightPt: number;
      sourcePageBox: 'crop-box' | 'media-box';
    }>
  > {
    const result = await PdfRewrite.inspectPdf({ inputPath });
    if (!result.success || !result.pageDimensions) return [];
    return result.pageDimensions.filter(
      (page) =>
        Number.isFinite(page.pageNumber) &&
        page.pageNumber > 0 &&
        Number.isFinite(page.widthPt) &&
        page.widthPt > 0 &&
        Number.isFinite(page.heightPt) &&
        page.heightPt > 0,
    );
  }

  async createPdfFromCover(options: CreatePdfFromCoverOptions): Promise<void> {
    const result = await PdfRewrite.createPdfFromCover(options);
    if (!result.success) {
      throw new PdfRewriteError(result.error ?? 'REWRITE_FAILED', {
        message: result.message,
        stage: result.stage,
        requiredBytes: result.requiredBytes,
        availableBytes: result.availableBytes,
      });
    }
  }

  async rewriteCover(options: RewriteCoverOptions): Promise<RewriteCoverResult> {
    return PdfRewrite.rewriteCover(options);
  }

  async extractFirstPagePreview(options: ExtractFirstPagePreviewOptions): Promise<{
    tempImagePath: string;
    tempImageRelativePath?: string;
    mimeType: string;
    width?: number;
    height?: number;
  }> {
    const result = await PdfRewrite.extractFirstPagePreview(options);
    if (!result.success || !result.tempImagePath || !result.mimeType) {
      throw new PdfRewriteError(result.error ?? 'REWRITE_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
    return {
      tempImagePath: result.tempImagePath,
      tempImageRelativePath: result.tempImageRelativePath,
      mimeType: result.mimeType,
      width: result.width,
      height: result.height,
    };
  }

  async extractFirstPagePreviewFile(options: {
    inputPath: string;
    pdfName: string;
    maxDimension?: number;
  }): Promise<{ file: File; width?: number; height?: number }> {
    const extracted = await this.extractFirstPagePreview({
      inputPath: options.inputPath,
      maxDimension: options.maxDimension,
    });
    const nativeCacheBytes = extracted.tempImageRelativePath
      ? await this.readCacheFile(extracted.tempImageRelativePath)
      : null;
    const mimeType = extracted.mimeType || 'image/png';
    const baseName = (options.pdfName || 'pdf')
      .replace(/\.pdf$/i, '')
      .replace(/[^\w.-]/g, '_');
    const filename = `${baseName}_page1.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
    if (nativeCacheBytes?.byteLength) {
      const imageBuffer = nativeCacheBytes.buffer.slice(
        nativeCacheBytes.byteOffset,
        nativeCacheBytes.byteOffset + nativeCacheBytes.byteLength,
      ) as ArrayBuffer;
      return {
        file: new File([imageBuffer], filename, { type: mimeType }),
        width: extracted.width,
        height: extracted.height,
      };
    }
    const file = await this.readExtractedFile(
      extracted.tempImagePath,
      options.pdfName,
      mimeType,
    );
    return { file, width: extracted.width, height: extracted.height };
  }

  async openExternalFile(options: OpenExternalFileOptions): Promise<void> {
    const result = await PdfRewrite.openExternalFile(options);
    if (!result.success) {
      throw new PdfRewriteError(result.error ?? 'REWRITE_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
  }

  async cancelRewrite(): Promise<void> {
    if (!this.isSupported()) return;
    await PdfRewrite.cancelRewrite();
  }

  private async readExtractedFile(
    extractedPath: string,
    pdfName: string,
    fallbackMimeType?: string,
  ): Promise<File> {
    const uri = Capacitor.convertFileSrc(this.toFileUri(extractedPath));
    const response = await fetch(uri);
    if (!response.ok) {
      throw new PdfRewriteError('REWRITE_FAILED', {
        message: `fetch_status_${response.status}`,
        stage: 'extract_read',
      });
    }
    const blob = await response.blob();
    if (blob.size <= 0) {
      throw new PdfRewriteError('REWRITE_FAILED', {
        message: 'empty_extracted_image',
        stage: 'extract_read',
      });
    }
    const mimeType = fallbackMimeType || blob.type || 'image/png';
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const baseName = (pdfName || 'pdf').replace(/\.pdf$/i, '').replace(/[^\w.-]/g, '_');
    const filename = `${baseName}_page1.${ext}`;
    return new File([blob], filename, { type: mimeType });
  }

  private async readCacheFile(path: string): Promise<Uint8Array | null> {
    try {
      const result = await Filesystem.readFile({
        directory: Directory.Cache,
        path,
      });
      if (typeof result.data === 'string') {
        return this.decodeBase64(result.data);
      }
      return new Uint8Array(await result.data.arrayBuffer());
    } catch {
      return null;
    }
  }

  private decodeBase64(value: string): Uint8Array {
    const normalized = value.includes(',') ? value.split(',').pop() || '' : value;
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  private toFileUri(path: string): string {
    if (!path) return path;
    return path.startsWith('file://') ? path : `file://${path}`;
  }
}
