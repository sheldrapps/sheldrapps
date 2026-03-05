import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin, type Plugin } from '@capacitor/core';

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
};

type EpubRewritePlugin = Plugin & {
  createEpubFromCover(
    options: CreateEpubFromCoverOptions,
  ): Promise<CreateEpubFromCoverResult>;
  extractCoverAsset(
    options: ExtractCoverAssetOptions,
  ): Promise<ExtractCoverAssetResult>;
};

const EpubRewrite = registerPlugin<EpubRewritePlugin>('EpubRewritePlugin');

export class EpubRewriteError extends Error {
  constructor(
    readonly code: string,
    readonly details?: {
      message?: string;
      stage?: string;
      coverEntryPath?: string;
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

  async createEpubFromCover(options: CreateEpubFromCoverOptions): Promise<void> {
    const result = await EpubRewrite.createEpubFromCover(options);
    if (!result.success) {
      throw new EpubRewriteError(result.error ?? 'CREATE_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
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
    const response = await fetch(uri);
    if (!response.ok) {
      throw new EpubRewriteError('EXTRACT_READ_FAILED', {
        message: `fetch_status_${response.status}`,
        stage: 'extract_read',
      });
    }

    const blob = await response.blob();
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
