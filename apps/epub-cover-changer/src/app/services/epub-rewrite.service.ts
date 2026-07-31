import { Injectable } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
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
  coverEntryPath?: string;
  newCoverPath: string;
  replacementCoverEntryPath?: string;
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
  coverEntryPath?: string;
  coverInserted?: boolean;
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

type ScanFileResult = {
  success: boolean;
  error?: string;
  message?: string;
};

type PublicDocumentResult = {
  success: boolean;
  uri?: string;
  filename?: string;
  size?: number;
  copiedBytes?: number;
  error?: string;
  message?: string;
  stage?: string;
};

export type PublicDocumentEntry = {
  name: string;
  uri: string;
  size: number;
};

type PickAndPrepareEpubOptions = {
  maxBytes?: number;
  requireCover?: boolean;
  includeCoverPreview?: boolean;
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
  ensurePublicExportFolder(options: { folderName: string }): Promise<{
    success: boolean;
    uri?: string;
    error?: string;
    message?: string;
    stage?: string;
  }>;
  publishPublicDocument(options: {
    folderName: string;
    sourcePath: string;
    outputName: string;
    mimeType: string;
  }): Promise<PublicDocumentResult>;
  listPublicDocuments(options: {
    folderName: string;
    extension?: string;
  }): Promise<{
    success: boolean;
    files?: PublicDocumentEntry[];
    error?: string;
    message?: string;
    stage?: string;
  }>;
  getPublicDocument(options: {
    folderName: string;
    filename: string;
  }): Promise<PublicDocumentResult>;
  deletePublicDocument(options: {
    folderName: string;
    filename: string;
  }): Promise<PublicDocumentResult>;
  renamePublicDocument(options: {
    folderName: string;
    filename: string;
    outputName: string;
  }): Promise<PublicDocumentResult>;
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
  openExternalFile(
    options: OpenExternalFileOptions,
  ): Promise<OpenExternalFileResult>;
  scanFile(options: { path: string; mimeType?: string }): Promise<ScanFileResult>;
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

  async ensurePublicExportFolder(folderName: string): Promise<string> {
    const result = await EpubRewrite.ensurePublicExportFolder({ folderName });
    if (!result.success || !result.uri) {
      throw new EpubRewriteError(result.error ?? 'EXPORT_FOLDER_REQUIRED', {
        message: result.message,
        stage: result.stage,
      });
    }
    return result.uri;
  }

  async publishPublicDocument(options: {
    folderName: string;
    sourcePath: string;
    outputName: string;
    mimeType: string;
  }): Promise<{ uri: string; filename: string; size: number; copiedBytes: number }> {
    const result = await EpubRewrite.publishPublicDocument(options);
    if (
      !result.success ||
      !result.uri ||
      !result.filename ||
      typeof result.size !== 'number' ||
      typeof result.copiedBytes !== 'number'
    ) {
      throw new EpubRewriteError(result.error ?? 'PUBLIC_EXPORT_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
    return {
      uri: result.uri,
      filename: result.filename,
      size: result.size,
      copiedBytes: result.copiedBytes,
    };
  }

  async listPublicDocuments(folderName: string): Promise<readonly PublicDocumentEntry[]> {
    const result = await EpubRewrite.listPublicDocuments({
      folderName,
      extension: '.epub',
    });
    if (!result.success) {
      throw new EpubRewriteError(result.error ?? 'PUBLIC_LIST_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
    return result.files ?? [];
  }

  async getPublicDocument(
    folderName: string,
    filename: string,
  ): Promise<{ uri: string; filename: string; size: number }> {
    const result = await EpubRewrite.getPublicDocument({ folderName, filename });
    if (!result.success || !result.uri || !result.filename || typeof result.size !== 'number') {
      throw new EpubRewriteError(result.error ?? 'PUBLIC_DOCUMENT_NOT_FOUND', {
        message: result.message,
        stage: result.stage,
      });
    }
    return { uri: result.uri, filename: result.filename, size: result.size };
  }

  async deletePublicDocument(folderName: string, filename: string): Promise<void> {
    const result = await EpubRewrite.deletePublicDocument({ folderName, filename });
    if (!result.success) {
      throw new EpubRewriteError(result.error ?? 'PUBLIC_DELETE_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
  }

  async renamePublicDocument(
    folderName: string,
    filename: string,
    outputName: string,
  ): Promise<{ uri: string; filename: string; size: number }> {
    const result = await EpubRewrite.renamePublicDocument({
      folderName,
      filename,
      outputName,
    });
    if (!result.success || !result.uri || !result.filename || typeof result.size !== 'number') {
      throw new EpubRewriteError(result.error ?? 'PUBLIC_RENAME_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
    return { uri: result.uri, filename: result.filename, size: result.size };
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

  async openExternalFile(options: OpenExternalFileOptions): Promise<void> {
    const result = await EpubRewrite.openExternalFile(options);
    if (!result.success) {
      throw new EpubRewriteError(result.error ?? 'OPEN_FAILED', {
        message: result.message,
        stage: result.stage,
      });
    }
  }

  async scanFile(options: { path: string; mimeType?: string }): Promise<void> {
    const result = await EpubRewrite.scanFile(options);
    if (!result.success) {
      throw new EpubRewriteError(result.error ?? 'SCAN_FAILED', {
        message: result.message,
        stage: 'media_scan',
      });
    }
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
    const blob = await this.readExtractedCoverBlob(extractedCoverPath);
    const mimeType = blob.type || fallbackMimeType || this.mimeFromPath(coverEntryPath);
    const filename = this.buildCoverFilename(epubName, coverEntryPath);
    return new File([blob], filename, { type: mimeType });
  }

  private async readExtractedCoverBlob(extractedCoverPath: string): Promise<Blob> {
    const cachePath = this.toCacheRelativePath(extractedCoverPath);
    if (cachePath) {
      try {
        const result = await Filesystem.readFile({
          directory: Directory.Cache,
          path: cachePath,
        });
        if (typeof result.data === 'string') {
          return this.base64ToBlob(result.data);
        }
        return result.data;
      } catch {
      }
    }

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

    try {
      return await response.blob();
    } catch (error) {
      throw new EpubRewriteError('EXTRACT_READ_FAILED', {
        message: error instanceof Error ? error.message : String(error),
        stage: 'extract_read',
      });
    }
  }

  private toCacheRelativePath(extractedCoverPath: string): string | null {
    const normalized = decodeURIComponent(extractedCoverPath || '')
      .replace(/\\/g, '/')
      .trim();
    const marker = '/cache/';
    const markerIndex = normalized.toLowerCase().indexOf(marker);
    if (markerIndex < 0) return null;

    const relative = normalized.slice(markerIndex + marker.length).replace(/^\/+/, '');
    return relative || null;
  }

  private base64ToBlob(data: string): Blob {
    const normalized = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes]);
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
