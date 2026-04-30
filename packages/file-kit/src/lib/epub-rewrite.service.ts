import { Injectable } from '@angular/core';
import {
  Capacitor,
  registerPlugin,
  type Plugin,
  type PluginListenerHandle,
} from '@capacitor/core';

type InspectEpubResult = {
  success: boolean;
  coverEntryPath?: string;
  extractedCoverPath?: string;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
};

export type PrepareEpubOptions = {
  uri: string;
  displayName?: string;
  maxBytes?: number;
};

export type PrepareEpubResult = {
  sessionId: string;
  originalName: string;
  originalSize: number;
  isZipReadable: boolean;
  workingPath?: string;
  workingName?: string;
  workingNativePath?: string;
  outputBaseName?: string;
};

type RewriteCoverOptions = {
  inputPath: string;
  outputPath?: string;
  coverEntryPath: string;
  newCoverPath: string;
};

type CreateEpubFromCoverOptions = {
  outputPath: string;
  coverPath: string;
  title?: string;
  lang?: string;
  appName?: string;
};

type CreateEpubFromCoverResult = {
  success: boolean;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
};

type RewriteCoverResult = {
  success: boolean;
  error?: string;
  message?: string;
  stage?: string;
  outputPath?: string;
  requiredBytes?: number;
  availableBytes?: number;
};

type ExtractCoverAssetOptions = {
  epubPath: string;
  preferCoverEntryPath?: string;
  maxBytes?: number;
};

type ExtractCoverAssetResult = {
  success: boolean;
  tempImagePath?: string;
  mimeType?: string;
  coverEntryPath?: string;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
};

type PickAndPrepareEpubOptions = {
  maxBytes?: number;
  requireCover?: boolean;
  includeCoverPreview?: boolean;
};

type PickAndPrepareEpubResult = {
  success: boolean;
  sessionId?: string;
  originalName?: string;
  originalSize?: number;
  isZipReadable?: boolean;
  selectedName?: string;
  sourceSize?: number;
  sourceLastModified?: number;
  sourceMimeType?: string;
  workingPath?: string;
  workingName?: string;
  workingNativePath?: string;
  outputBaseName?: string;
  coverEntryPath?: string;
  extractedCoverPath?: string;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
};

type RewriteProgressEvent = {
  percent: number;
};

type EpubRewritePlugin = Plugin & {
  prepare(options: PrepareEpubOptions): Promise<{
    success: boolean;
    sessionId?: string;
    originalName?: string;
    originalSize?: number;
    isZipReadable?: boolean;
    workingPath?: string;
    workingName?: string;
    workingNativePath?: string;
    outputBaseName?: string;
    error?: string;
    message?: string;
    stage?: string;
    requiredBytes?: number;
    availableBytes?: number;
  }>;
  pickAndPrepareEpub(
    options: PickAndPrepareEpubOptions,
  ): Promise<PickAndPrepareEpubResult>;
  inspectEpub(options: { inputPath: string }): Promise<InspectEpubResult>;
  rewriteCover(options: RewriteCoverOptions): Promise<RewriteCoverResult>;
  createEpubFromCover(
    options: CreateEpubFromCoverOptions,
  ): Promise<CreateEpubFromCoverResult>;
  extractCoverAsset(
    options: ExtractCoverAssetOptions,
  ): Promise<ExtractCoverAssetResult>;
  cleanup(options: { sessionId: string }): Promise<void>;
  cancelRewrite(): Promise<{ cancelled: boolean }>;
};

const EpubRewrite = registerPlugin<EpubRewritePlugin>('EpubRewritePlugin');

export class EpubRewriteError extends Error {
  constructor(
    readonly code: string,
    readonly details?: {
      message?: string;
      stage?: string;
      coverEntryPath?: string;
      requiredBytes?: number;
      availableBytes?: number;
    },
  ) {
    super(details?.message ? `${code}: ${details.message}` : code);
    this.name = 'EpubRewriteError';
  }
}

@Injectable({ providedIn: 'root' })
export class EpubRewriteService {
  isSupported(): boolean {
    return (
      Capacitor.getPlatform() === 'android' &&
      Capacitor.isPluginAvailable('EpubRewritePlugin')
    );
  }

  addProgressListener(
    listener: (event: RewriteProgressEvent) => void,
  ): Promise<PluginListenerHandle> {
    return EpubRewrite.addListener('rewriteProgress', listener);
  }

  async prepare(options: PrepareEpubOptions): Promise<PrepareEpubResult> {
    const result = await EpubRewrite.prepare(options);
    return this.requirePreparedResult(result, result.originalName);
  }

  async pickAndPrepareEpub(options: PickAndPrepareEpubOptions): Promise<{
    sessionId: string;
    originalName: string;
    originalSize: number;
    isZipReadable: boolean;
    selectedName: string;
    sourceSize: number;
    sourceLastModified: number;
    sourceMimeType: string;
    workingPath: string;
    workingName: string;
    workingNativePath: string;
    outputBaseName: string;
    coverEntryPath?: string;
    file?: File;
  }> {
    const result = await EpubRewrite.pickAndPrepareEpub(options);
    const prepared = this.requirePreparedResult(
      result,
      result.selectedName ?? result.originalName,
    );

    let file: File | undefined;
    if (result.extractedCoverPath && result.coverEntryPath) {
      try {
        file = await this.readExtractedFile(
          result.extractedCoverPath,
          result.coverEntryPath,
          result.selectedName || prepared.originalName,
        );
      } catch (error) {
        if (error instanceof EpubRewriteError) {
          throw new EpubRewriteError(error.code, {
            ...error.details,
            coverEntryPath: result.coverEntryPath,
          });
        }
        throw new EpubRewriteError('EXTRACT_READ_FAILED', {
          message: error instanceof Error ? error.message : String(error),
          stage: 'extract_read',
          coverEntryPath: result.coverEntryPath,
        });
      }
    }

    return {
      sessionId: prepared.sessionId,
      originalName: prepared.originalName,
      originalSize: prepared.originalSize,
      isZipReadable: prepared.isZipReadable,
      selectedName: result.selectedName || prepared.originalName,
      sourceSize: result.sourceSize ?? 0,
      sourceLastModified: result.sourceLastModified ?? Date.now(),
      sourceMimeType: result.sourceMimeType || 'application/epub+zip',
      workingPath: prepared.workingPath || '',
      workingName: prepared.workingName || '',
      workingNativePath: prepared.workingNativePath || '',
      outputBaseName: prepared.outputBaseName || '',
      coverEntryPath: result.coverEntryPath,
      file,
    };
  }

  async inspectEpub(inputPath: string): Promise<InspectEpubResult> {
    return EpubRewrite.inspectEpub({ inputPath });
  }

  async createEpubFromCover(options: CreateEpubFromCoverOptions): Promise<void> {
    const result = await EpubRewrite.createEpubFromCover(options);
    if (!result.success) {
      throw new EpubRewriteError(result.error ?? 'CREATE_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
  }

  async rewriteCover(
    options: RewriteCoverOptions,
  ): Promise<RewriteCoverResult> {
    return EpubRewrite.rewriteCover(options);
  }

  async extractCoverAsset(
    options: ExtractCoverAssetOptions,
  ): Promise<{ tempImagePath: string; mimeType: string; coverEntryPath?: string }> {
    const result = await EpubRewrite.extractCoverAsset(options);
    if (!result.success || !result.tempImagePath || !result.mimeType) {
      throw new EpubRewriteError(result.error ?? 'EXTRACT_FAILED', {
        message: result.message,
        stage: result.stage,
        coverEntryPath: result.coverEntryPath,
        requiredBytes: result.requiredBytes,
        availableBytes: result.availableBytes,
      });
    }

    return {
      tempImagePath: result.tempImagePath,
      mimeType: result.mimeType,
      coverEntryPath: result.coverEntryPath,
    };
  }

  async extractCoverAssetFile(options: ExtractCoverAssetOptions & { epubName: string }) {
    const extracted = await this.extractCoverAsset(options);
    const file = await this.readExtractedFile(
      extracted.tempImagePath,
      extracted.coverEntryPath ?? 'cover.jpg',
      options.epubName,
      extracted.mimeType,
    );

    return {
      ...extracted,
      file,
    };
  }

  async cancelRewrite(): Promise<void> {
    if (!this.isSupported()) return;
    await EpubRewrite.cancelRewrite();
  }

  async cleanup(sessionId: string): Promise<void> {
    if (!this.isSupported() || !sessionId) return;
    await EpubRewrite.cleanup({ sessionId });
  }

  toNativePath(uriOrPath: string): string {
    if (!uriOrPath) return uriOrPath;
    if (uriOrPath.startsWith('file://')) {
      return decodeURIComponent(uriOrPath.replace(/^file:\/\//, ''));
    }
    return uriOrPath;
  }

  toFileUri(path: string): string {
    if (!path) return path;
    return path.startsWith('file://') ? path : `file://${path}`;
  }

  private async readExtractedFile(
    extractedCoverPath: string,
    coverEntryPath: string,
    epubName: string,
    fallbackMimeType?: string,
  ): Promise<File> {
    const uri = Capacitor.convertFileSrc(this.toFileUri(extractedCoverPath));
    let response: Response;
    try {
      response = await fetch(uri);
    } catch (error) {
      throw new EpubRewriteError('EXTRACT_READ_FAILED', {
        message: error instanceof Error ? error.message : String(error),
        stage: 'extract_read',
      });
    }
    if (!response.ok) {
      throw new EpubRewriteError('EXTRACT_READ_FAILED', {
        message: `fetch_status_${response.status}`,
        stage: 'extract_read',
      });
    }

    let blob: Blob;
    try {
      blob = await response.blob();
    } catch (error) {
      throw new EpubRewriteError('EXTRACT_READ_FAILED', {
        message: error instanceof Error ? error.message : String(error),
        stage: 'extract_read',
      });
    }

    const mimeType = blob.type || fallbackMimeType || this.mimeFromPath(coverEntryPath);
    const filename = this.buildCoverFilename(epubName, coverEntryPath);
    return new File([blob], filename, { type: mimeType });
  }

  private buildCoverFilename(epubName: string, coverEntryPath: string): string {
    const baseName = (epubName || 'epub')
      .replace(/\.epub$/i, '')
      .replace(/[^\w.-]/g, '_');
    const ext = this.extensionFromPath(coverEntryPath) || 'jpg';
    return `${baseName}_cover.${ext}`;
  }

  private extensionFromPath(path: string): string {
    const normalized = (path || '').replace(/\\/g, '/');
    const ext = normalized.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'jpeg') return 'jpg';
    return ext;
  }

  private mimeFromPath(path: string): string {
    const ext = this.extensionFromPath(path);
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  }

  private requirePreparedResult(
    result: {
      success: boolean;
      sessionId?: string;
      originalName?: string;
      originalSize?: number;
      isZipReadable?: boolean;
      workingPath?: string;
      workingName?: string;
      workingNativePath?: string;
      outputBaseName?: string;
      error?: string;
      message?: string;
      stage?: string;
      requiredBytes?: number;
      availableBytes?: number;
      coverEntryPath?: string;
    },
    fallbackName?: string,
  ): PrepareEpubResult {
    if (
      !result.success ||
      !result.sessionId ||
      !result.originalName ||
      !result.workingPath ||
      !result.workingName ||
      !result.workingNativePath ||
      !result.outputBaseName
    ) {
      throw new EpubRewriteError(result.error ?? 'PREPARE_FAILED', {
        message: result.message,
        stage: result.stage,
        coverEntryPath: result.coverEntryPath,
        requiredBytes: result.requiredBytes,
        availableBytes: result.availableBytes,
      });
    }

    return {
      sessionId: result.sessionId,
      originalName: result.originalName || fallbackName || result.workingName,
      originalSize: result.originalSize ?? 0,
      isZipReadable: result.isZipReadable !== false,
      workingPath: result.workingPath,
      workingName: result.workingName,
      workingNativePath: result.workingNativePath,
      outputBaseName: result.outputBaseName,
    };
  }
}
