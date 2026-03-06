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
};

type PickAndPrepareEpubResult = {
  success: boolean;
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

  async pickAndPrepareEpub(options: PickAndPrepareEpubOptions): Promise<{
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
    if (
      !result.success ||
      !result.workingPath ||
      !result.workingName ||
      !result.workingNativePath ||
      !result.outputBaseName
    ) {
      throw new EpubRewriteError(result.error ?? 'PICK_FAILED', {
        message: result.message,
        stage: result.stage,
        coverEntryPath: result.coverEntryPath,
        requiredBytes: result.requiredBytes,
        availableBytes: result.availableBytes,
      });
    }

    let file: File | undefined;
    if (result.extractedCoverPath && result.coverEntryPath) {
      try {
        file = await this.readExtractedFile(
          result.extractedCoverPath,
          result.coverEntryPath,
          result.selectedName || result.workingName,
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
      selectedName: result.selectedName || result.workingName,
      sourceSize: result.sourceSize ?? 0,
      sourceLastModified: result.sourceLastModified ?? Date.now(),
      sourceMimeType: result.sourceMimeType || 'application/epub+zip',
      workingPath: result.workingPath,
      workingName: result.workingName,
      workingNativePath: result.workingNativePath,
      outputBaseName: result.outputBaseName,
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

  async extractCoverFile(
    inputPath: string,
    epubName: string,
  ): Promise<{ coverEntryPath: string; file: File }> {
    const result = await this.inspectEpub(inputPath);
    if (!result.success || !result.coverEntryPath || !result.extractedCoverPath) {
      throw new EpubRewriteError(result.error ?? 'REWRITE_FAILED', {
        message: result.message,
        stage: result.stage,
        requiredBytes: result.requiredBytes,
        availableBytes: result.availableBytes,
      });
    }

    let file: File;
    try {
      file = await this.readExtractedFile(
        result.extractedCoverPath,
        result.coverEntryPath,
        epubName,
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

    return {
      coverEntryPath: result.coverEntryPath,
      file,
    };
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
}
