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

type OpenExternalFileOptions = {
  inputPath: string;
  mimeType?: string;
  chooserTitle?: string;
};

type OpenExternalFileResult = {
  success: boolean;
  error?: string;
  message?: string;
  stage?: string;
};

type EpubRewritePlugin = Plugin & {
  listPublicDocuments(options: { folderName: string; extension?: string }): Promise<{ success: boolean; files?: Array<{ name: string; uri: string; size: number }>; error?: string; message?: string; stage?: string }>;
  getPublicDocument(options: { folderName: string; filename: string }): Promise<{ success: boolean; uri?: string; filename?: string; size?: number; error?: string; message?: string; stage?: string }>;
  deletePublicDocument(options: { folderName: string; filename: string }): Promise<{ success: boolean; error?: string; message?: string; stage?: string }>;
  renamePublicDocument(options: { folderName: string; filename: string; outputName: string }): Promise<{ success: boolean; uri?: string; filename?: string; size?: number; error?: string; message?: string; stage?: string }>;
  publishPublicDocument(options: {
    folderName: string;
    sourcePath: string;
    outputName: string;
    mimeType: string;
  }): Promise<{
    success: boolean;
    uri?: string;
    filename?: string;
    size?: number;
    copiedBytes?: number;
    error?: string;
    message?: string;
    stage?: string;
  }>;
  createEpubFromCover(
    options: CreateEpubFromCoverOptions,
  ): Promise<CreateEpubFromCoverResult>;
  extractCoverAsset(
    options: ExtractCoverAssetOptions,
  ): Promise<ExtractCoverAssetResult>;
  openExternalFile(
    options: OpenExternalFileOptions,
  ): Promise<OpenExternalFileResult>;
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

  async publishPublicDocument(options: {
    folderName: string;
    sourcePath: string;
    outputName: string;
    mimeType: string;
  }): Promise<{ uri: string; filename: string; size: number }> {
    const result = await EpubRewrite.publishPublicDocument(options);
    if (!result.success || !result.uri || !result.filename || typeof result.size !== 'number') {
      throw new EpubRewriteError(result.error ?? 'PUBLIC_EXPORT_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
    return { uri: result.uri, filename: result.filename, size: result.size };
  }

  async listPublicDocuments(folderName: string): Promise<readonly { name: string; uri: string; size: number }[]> {
    const result = await EpubRewrite.listPublicDocuments({ folderName, extension: '.epub' });
    if (!result.success) throw new EpubRewriteError(result.error ?? 'PUBLIC_LIST_FAILED', { message: result.message, stage: result.stage });
    return result.files ?? [];
  }

  async getPublicDocument(folderName: string, filename: string): Promise<{ uri: string; filename: string; size: number }> {
    const result = await EpubRewrite.getPublicDocument({ folderName, filename });
    if (!result.success || !result.uri || !result.filename || typeof result.size !== 'number') throw new EpubRewriteError(result.error ?? 'PUBLIC_DOCUMENT_NOT_FOUND', { message: result.message, stage: result.stage });
    return { uri: result.uri, filename: result.filename, size: result.size };
  }

  async deletePublicDocument(folderName: string, filename: string): Promise<void> {
    const result = await EpubRewrite.deletePublicDocument({ folderName, filename });
    if (!result.success) throw new EpubRewriteError(result.error ?? 'PUBLIC_DELETE_FAILED', { message: result.message, stage: result.stage });
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

  async openExternalFile(options: OpenExternalFileOptions): Promise<void> {
    const result = await EpubRewrite.openExternalFile(options);
    if (!result.success) {
      throw new EpubRewriteError(result.error ?? 'OPEN_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
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
