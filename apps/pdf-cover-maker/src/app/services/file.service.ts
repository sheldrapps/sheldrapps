import { Injectable, inject } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import {
  PdfPublicStore,
  FileKitService,
  FileRef,
  ensureDirectoriesExist,
  WebPdfCoverService,
  WEB_PDF_COVER_SERVICE_TOKEN,
} from '@sheldrapps/file-kit/pdf';
import { TranslateService } from '@ngx-translate/core';
import {
  analyzeDitherPreview,
  buildOptimizedPreviewDataUrl,
  type ArtifactReductionMode,
  type CoverColorMode,
  type CoverCropState,
} from '@sheldrapps/image-workflow';
import { PdfRewriteError, PdfRewriteService } from './pdf-rewrite.service';

export type CoverEntry = {
  filename: string;
  pdfPath: string;
  thumbPath: string;
};

export type ProjectEntry = {
  filename: string;
  projectPath: string;
  sourcePath: string;
  thumbPath: string;
  coverFilename: string;
  savedAt?: string;
};

export type SavedCoverProject = {
  schemaVersion: 1;
  kind: 'pdf-cover-maker-project';
  savedAt: string;
  coverFilename: string;
  sourceFilename: string;
  sourceMimeType: string;
  cropState: CoverCropState;
  target: {
    width: number;
    height: number;
  };
  coverMetadata?: CoverProcessingMetadataInput;
  sourceInfo?: {
    name?: string;
    width?: number;
    height?: number;
    originalName?: string;
    originalWidth?: number;
    originalHeight?: number;
  };
};

export type SaveProjectResult = {
  projectPath: string;
  sourcePath: string;
  thumbPath: string;
  filename: string;
};

export type LoadedCoverProject = {
  snapshot: SavedCoverProject;
  sourceFile: File;
};

export type PreviewCoverResult = {
  dataUrl: string | null;
  source: 'cover-export' | 'thumb-fallback' | 'unavailable';
};

export type CoverAssetsResult = {
  coverDataUrl: string | null;
  thumbDataUrl: string | null;
  previewDataUrl: string | null;
};

export type NativeDocumentOutputTarget = {
  filename: string;
  relativePath: string;
  nativePath: string;
};

export type GeneratedFileSaveOptions = {
  overwriteExisting?: boolean;
};

export type ResolvedCoverPreviewAsset = {
  src: string;
  isDithered: boolean;
  source:
    | 'file'
    | 'thumbnail'
    | 'pdf-metadata'
    | 'generated-preview'
    | 'inferred'
    | 'unavailable';
  width?: number;
  height?: number;
};

export type CoverProcessingMetadataInput = {
  colorMode?: CoverColorMode;
  artifactReductionEnabled?: boolean;
  artifactReductionMode?: ArtifactReductionMode | null;
  isDithered?: boolean;
  ditherAlgorithm?: string | null;
};

type DitherDetectionSource = 'local-metadata' | 'pdf-metadata' | 'inferred';

type ResolvedDitherMetadata = {
  isDithered: boolean;
  colorMode?: CoverColorMode;
  artifactReductionEnabled?: boolean;
  artifactReductionMode?: ArtifactReductionMode | null;
  detectionSource: DitherDetectionSource;
  ditherAlgorithm?: string | null;
  renderKind?: string | null;
  width?: number;
  height?: number;
};

@Injectable({ providedIn: 'root' })
export class FileService {
  private translate = inject(TranslateService);

  private readonly PDF_FOLDER = 'pdfcovermaker';
  private readonly COVER_FOLDER = 'pdfcovermakerCovers';
  private readonly THUMB_FOLDER = 'pdfcovermakerThumbs';
  private readonly PROJECT_FOLDER = 'pdfcovermakerProjects';
  private readonly PROJECT_THUMB_FOLDER = 'pdfcovermakerProjectThumbs';
  private readonly THUMB_MAX_WIDTH = 320;
  private readonly THUMB_QUALITY = 0.82;
  private readonly COVER_EXTRACT_MAX_BYTES = 30 * 1024 * 1024;
  private readonly APP_NAME = 'PDF Cover Maker';
  private readonly LEGACY_PDF_FOLDERS = ['CoverCreator'];
  private fileKit = inject(FileKitService);
  private pdfRewrite = inject(PdfRewriteService);
  private webPdfCover = inject(WEB_PDF_COVER_SERVICE_TOKEN, {
    optional: true,
  }) as WebPdfCoverService | null;
  private readonly thumbDataUrlCache = new Map<string, string>();
  private thumbFileNamesCache: Set<string> | null = null;
  private thumbFileNamesCachePromise: Promise<Set<string>> | null = null;
  private legacyMigrationBackgroundPromise: Promise<void> | null = null;
  private readonly resolvedPreviewCache = new Map<
    string,
    ResolvedCoverPreviewAsset
  >();
  private readonly ditherMetadataCache = new Map<
    string,
    ResolvedDitherMetadata
  >();
  // Temporary instrumentation for robust public PDF discovery validation.
  private readonly DEBUG_IO = true;
  private readonly OPTIMIZED_PREVIEW_MAX_SIDE = 1600;
  private hasMigratedLegacyPdfFolders = false;
  private readonly pdfStore = new PdfPublicStore(this.fileKit, {
    pdfFolder: this.PDF_FOLDER,
    debug: this.DEBUG_IO,
    logPrefix: 'ECC:file-kit',
  });
  private readonly legacyPdfStores = this.LEGACY_PDF_FOLDERS.map(
    (legacyFolder) =>
      new PdfPublicStore(this.fileKit, {
        pdfFolder: legacyFolder,
        debug: this.DEBUG_IO,
        logPrefix: `ECC:file-kit-legacy:${legacyFolder}`,
      }),
  );

  /**
   * Validate an PDF file
   */
  validatePdf(
    file: File,
    maxSizeMB: number = 50,
  ): { valid: boolean; errorKey?: string } {
    return this.fileKit.validatePdf(file, maxSizeMB);
  }

  async validatePdfStructure(file: File): Promise<boolean> {
    if (!this.pdfRewrite.isSupported()) {
      if (!this.webPdfCover) {
        throw new Error('Web PDF cover support not available in this build');
      }
      return this.webPdfCover.isReadablePdf(file);
    }
    const tempName = `validate_${Date.now()}_${file.name || 'pdf'}`;
    const tempPath = `${this.PDF_FOLDER}/${tempName}`;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.fileKit.writeBytes({
        dir: 'Cache',
        path: tempPath,
        bytes,
        mimeType: 'application/pdf',
      });

      const uri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempPath,
      });
      const inspected = await this.pdfRewrite.inspectPdf(uri);
      return inspected.valid;
    } catch {
      return false;
    } finally {
      try {
        await this.fileKit.delete({ dir: 'Cache', path: tempPath });
      } catch {
        // best effort
      }
    }
  }

  async extractCoverFromPdfFile(file: File): Promise<File | null> {
    if (!this.pdfRewrite.isSupported()) {
      if (!this.webPdfCover) {
        throw new Error('Web PDF cover support not available in this build');
      }
      return this.webPdfCover.extractCover(file);
    }
    const tempName = `extract_${Date.now()}_${file.name || 'pdf'}`;
    const tempPath = `${this.PDF_FOLDER}/${tempName}`;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.fileKit.writeBytes({
        dir: 'Cache',
        path: tempPath,
        bytes,
        mimeType: 'application/pdf',
      });
      const uri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempPath,
      });
      const extracted = await this.pdfRewrite.extractFirstPagePreviewFile({
        inputPath: uri,
        pdfName: file.name || 'pdf',
        maxDimension: 1600,
      });
      return extracted.file;
    } catch (error) {
      console.warn('[PCM_WEB_PDF_FALLBACK] extractCoverFromPdfFile failed', error);
      return null;
    } finally {
      try {
        await this.fileKit.delete({ dir: 'Cache', path: tempPath });
      } catch {
        // best effort
      }
    }
  }

  async savePdf(opts: {
    modelId: string;
    coverFile: File;
    title?: string;
    filename?: string;
  }) {
    const generated = await this.generatePdfBytes(opts);
    return this.saveGeneratedPdf({
      bytes: generated.bytes,
      filename: generated.filename,
      coverFileForThumb: opts.coverFile,
    });
  }

  async sharePdf(opts: { modelId: string; coverFile: File; title?: string }) {
    const generated = await this.generatePdfBytes(opts);
    return this.shareGeneratedPdf({
      bytes: generated.bytes,
      filename: generated.filename,
      title: opts.title,
    });
  }

  getPdfFolder() {
    return this.PDF_FOLDER;
  }

  getThumbFolder() {
    return this.THUMB_FOLDER;
  }

  getThumbPathForPdfFilename(pdfFilename: string) {
    const baseName = pdfFilename.replace(/\.pdf$/i, '');
    return `${this.THUMB_FOLDER}/${baseName}.jpg`;
  }

  getProjectThumbPathForFilename(filename: string) {
    const baseName = this.getBaseNameFromPdfFilename(filename);
    return `${this.PROJECT_THUMB_FOLDER}/${baseName}.jpg`;
  }

  getProjectPathForFilename(filename: string) {
    const baseName = this.getBaseNameFromPdfFilename(filename);
    return `${this.PROJECT_FOLDER}/${baseName}.json`;
  }

  async listProjects(): Promise<ProjectEntry[]> {
    await this.ensureProjectFoldersReady();
    const files = await this.listProjectJsonFiles();
    const projects: ProjectEntry[] = [];

    for (const filename of files) {
      const snapshot = await this.readProjectSnapshotByFilename(filename);
      if (!snapshot) continue;

      const baseName = this.getBaseNameFromPdfFilename(snapshot.coverFilename);
      projects.push({
        filename,
        projectPath: `${this.PROJECT_FOLDER}/${filename}`,
        sourcePath: `${this.PROJECT_FOLDER}/${snapshot.sourceFilename}`,
        thumbPath: `${this.PROJECT_THUMB_FOLDER}/${baseName}.jpg`,
        coverFilename: snapshot.coverFilename,
        savedAt: snapshot.savedAt,
      });
    }

    return projects.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  async hasProjectByFilename(filename: string): Promise<boolean> {
    await this.ensureProjectFoldersReady();
    return this.fileKit.exists({
      dir: 'Data',
      path: this.getProjectPathForFilename(filename),
    });
  }

  async loadProjectByFilename(
    filename: string,
  ): Promise<LoadedCoverProject | null> {
    await this.ensureProjectFoldersReady();
    const projectFilename = filename.toLowerCase().endsWith('.json')
      ? filename
      : `${this.getBaseNameFromPdfFilename(filename)}.json`;
    const snapshot = await this.readProjectSnapshotByFilename(projectFilename);
    if (!snapshot) return null;

    try {
      const sourceBytes = await this.fileKit.readBytes({
        dir: 'Data',
        path: `${this.PROJECT_FOLDER}/${snapshot.sourceFilename}`,
      });
      const sourceBuffer = new ArrayBuffer(sourceBytes.byteLength);
      new Uint8Array(sourceBuffer).set(sourceBytes);
      const sourceMimeType = this.resolveProjectSourceMimeType(
        snapshot.sourceMimeType,
        snapshot.sourceFilename,
        sourceBytes,
      );
      const sourceFile = new File([sourceBuffer], snapshot.sourceFilename, {
        type: sourceMimeType,
      });
      return { snapshot, sourceFile };
    } catch {
      return null;
    }
  }

  async loadGeneratedPdfByFilename(filename: string): Promise<File | null> {
    await this.ensurpdflicDocumentsPdfFolderReady();
    const normalizedFilename = this.ensurePdfExt(this.sanitizeFilename(filename));

    try {
      const bytes = await this.readPublicPdfBytes(normalizedFilename);
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);

      return new File([buffer], normalizedFilename, {
        type: 'application/pdf',
        lastModified: Date.now(),
      });
    } catch {
      return null;
    }
  }

  async listCovers(): Promise<CoverEntry[]> {
    await this.ensurpdflicDocumentsPdfFolderReady({
      skipLegacyMigration: true,
    });
    let files: string[] = [];
    try {
      files = await this.listPdfsFromPublicDocuments();
    } catch (error) {
      this.debugLog('listCovers:fallbackDocumentsDirectory', {
        error: this.errorDetails(error),
      });
      files = await this.listDirectoryDocumentsPdfs();
    }
    this.debugLog('listCovers', {
      reloadAt: new Date().toISOString(),
      count: files.length,
      files,
    });

    return files.map((filename) => ({
      filename,
      pdfPath: `${this.PDF_FOLDER}/${filename}`,
      thumbPath: this.getThumbPathForPdfFilename(filename),
    }));
  }

  async hasCoverByFilename(filename: string): Promise<boolean> {
    await this.ensurpdflicDocumentsPdfFolderReady();
    if (!this.pdfRewrite.isSupported()) {
      return this.fileKit.exists({
        dir: 'Documents',
        path: `${this.PDF_FOLDER}/${filename}`,
      });
    }
    return this.existsInPublicDocuments(filename);
  }

  async deleteCoverByFilename(filename: string) {
    await this.ensurpdflicDocumentsPdfFolderReady();
    this.debugLog('deleteCoverByFilename:start', { filename });
    const pdfPath = `${this.PDF_FOLDER}/${filename}`;
    const thumbPath = this.getThumbPathForPdfFilename(filename);
    this.clearThumbCache(filename);
    this.clearResolvedPreviewCache(filename);
    this.markThumbMissing(filename);

    await this.deletpdflicPdf(filename);
    await this.deleteDocumentPdfIfExists(pdfPath);

    // Use file-kit to delete thumbnail
    try {
      await this.fileKit.delete({
        dir: 'Data',
        path: thumbPath,
      });
    } catch {
      // ignore thumb missing
    }

    const coverBaseName = this.getBaseNameFromPdfFilename(filename);
    const coverCandidates = this.getCoverExportCandidates(coverBaseName);
    for (const candidate of coverCandidates) {
      try {
        await this.fileKit.delete({
          dir: 'Data',
          path: candidate.path,
        });
      } catch {
        // ignore missing cover export variants
      }
    }
    await this.deleteProjectSnapshotAssets(this.getBaseNameFromPdfFilename(filename));
    this.debugLog('deleteCoverByFilename:done', { filename });
  }

  async shareCoverByFilename(filename: string) {
    await this.ensurpdflicDocumentsPdfFolderReady();
    const normalizedFilename = this.ensurePdfExt(this.sanitizeFilename(filename));
    const fileRef = await this.stagePublicPdfForShare(normalizedFilename);
    this.debugLog('shareCoverByFilename', {
      filename: normalizedFilename,
      uri: fileRef.uri,
    });

    await this.fileKit.share(fileRef, {
      title: normalizedFilename,
      dialogTitle: 'Share PDF',
    });

    return { uri: fileRef.uri, filename: normalizedFilename };
  }

  async openCoverByFilename(filename: string) {
    await this.ensurpdflicDocumentsPdfFolderReady();
    const normalizedFilename = this.ensurePdfExt(this.sanitizeFilename(filename));
    const fileRef = await this.stagePublicPdfForShare(normalizedFilename);
    this.debugLog('openCoverByFilename', {
      filename: normalizedFilename,
      uri: fileRef.uri,
    });

    if (!this.pdfRewrite.isSupported()) {
      await this.fileKit.share(fileRef, {
        title: normalizedFilename,
        dialogTitle: 'Open PDF',
      });
      return { uri: fileRef.uri, filename: normalizedFilename };
    }

    await this.pdfRewrite.openExternalFile({
      inputPath: fileRef.uri,
      mimeType: 'application/pdf',
      chooserTitle: 'Open PDF',
    });

    return { uri: fileRef.uri, filename: normalizedFilename };
  }

  async getOrBuildThumbDataUrlForFilename(
    filename: string,
  ): Promise<string | null> {
    const cached = this.getThumbCache(filename);
    if (cached) {
      return cached;
    }

    const thumbPath = this.getThumbPathForPdfFilename(filename);
    if (await this.hasThumbForFilename(filename)) {
      const thumbBase64 = await this.tryReadBase64FromFilesystem(thumbPath);
      if (thumbBase64) {
        const dataUrl = `data:image/jpeg;base64,${thumbBase64}`;
        this.setThumbCache(filename, dataUrl);
        return dataUrl;
      }
      this.markThumbMissing(filename);
    }

    let cover = await this.readCoverExport(filename);
    if (!cover) {
      cover = await this.extractAndPersistCoverFromPdf(filename);
    }
    if (!cover) {
      return null;
    }

    const builtThumbBase64 = await this.persistThumbFromCoverExport(
      filename,
      cover,
    );
    if (!builtThumbBase64) {
      return null;
    }

    const dataUrl = `data:image/jpeg;base64,${builtThumbBase64}`;
    this.setThumbCache(filename, dataUrl);
    return dataUrl;
  }

  async getBestPreviewCoverDataUrl(
    filename: string,
    opts?: { forceRebuildThumb?: boolean; allowNativeExtract?: boolean },
  ): Promise<PreviewCoverResult> {
    const assets = await this.ensureCoverAssets(filename, {
      forceThumbRebuild: !!opts?.forceRebuildThumb,
      allowNativeExtract: opts?.allowNativeExtract ?? true,
    });

    if (assets.coverDataUrl) {
      return {
        dataUrl: assets.coverDataUrl,
        source: 'cover-export',
      };
    }

    if (assets.thumbDataUrl) {
      return {
        dataUrl: assets.thumbDataUrl,
        source: 'thumb-fallback',
      };
    }

    return { dataUrl: null, source: 'unavailable' };
  }

  async resolveCoverPreviewAsset(
    filename: string,
    opts?: {
      forceRebuildThumb?: boolean;
      allowNativeExtract?: boolean;
      forceRefresh?: boolean;
    },
  ): Promise<ResolvedCoverPreviewAsset> {
    const cacheKey = this.ensurePdfExt(this.sanitizeFilename(filename));
    const canUseCache = !opts?.forceRebuildThumb && !opts?.forceRefresh;
    if (canUseCache) {
      const cached = this.resolvedPreviewCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const assets = await this.ensureCoverAssets(cacheKey, {
      forceThumbRebuild: !!opts?.forceRebuildThumb,
      allowNativeExtract: opts?.allowNativeExtract ?? true,
    });
    const baseSrc = assets.coverDataUrl ?? assets.thumbDataUrl ?? null;

    if (!baseSrc) {
      const unavailable: ResolvedCoverPreviewAsset = {
        src: '',
        isDithered: false,
        source: 'unavailable',
      };
      this.resolvedPreviewCache.set(cacheKey, unavailable);
      return unavailable;
    }

    const metadata = await this.resolveDitherMetadata(cacheKey, baseSrc, {
      forceRefresh: !!opts?.forceRefresh,
    });
    let src = baseSrc;
    let source: ResolvedCoverPreviewAsset['source'] = assets.coverDataUrl
      ? 'file'
      : 'thumbnail';
    let width = metadata.width;
    let height = metadata.height;

    if (metadata.isDithered) {
      const isLossyJpegSource = /^data:image\/(jpeg|jpg);base64,/i.test(
        baseSrc,
      );
      const optimized = await buildOptimizedPreviewDataUrl(baseSrc, {
        maxSide: this.OPTIMIZED_PREVIEW_MAX_SIDE,
        preserveHardEdges: true,
        keepSourceResolution: true,
        reDitherFromLossySource: isLossyJpegSource,
        mimeType: 'image/png',
      });
      if (optimized?.dataUrl) {
        src = optimized.dataUrl;
        source = 'generated-preview';
        width = optimized.width;
        height = optimized.height;
      } else if (metadata.detectionSource === 'pdf-metadata') {
        source = 'pdf-metadata';
      } else if (metadata.detectionSource === 'inferred') {
        source = 'inferred';
      }
    } else if (metadata.detectionSource === 'pdf-metadata') {
      source = 'pdf-metadata';
    } else if (metadata.detectionSource === 'inferred') {
      source = 'inferred';
    }

    const resolved: ResolvedCoverPreviewAsset = {
      src,
      isDithered: metadata.isDithered,
      source,
      width,
      height,
    };
    this.resolvedPreviewCache.set(cacheKey, resolved);
    return resolved;
  }

  async ensureCoverAssets(
    pdfFilename: string,
    opts?: { forceThumbRebuild?: boolean; allowNativeExtract?: boolean },
  ): Promise<CoverAssetsResult> {
    let cover = await this.readCoverExport(pdfFilename);
    const thumbPath = this.getThumbPathForPdfFilename(pdfFilename);
    let thumbBase64 = !opts?.forceThumbRebuild
      ? await this.tryReadBase64FromFilesystem(thumbPath)
      : null;

    if (cover && (!thumbBase64 || opts?.forceThumbRebuild)) {
      thumbBase64 = await this.persistThumbFromCoverExport(pdfFilename, cover);
    }

    if (!cover && !thumbBase64) {
      thumbBase64 = await this.tryReadBase64FromFilesystem(thumbPath);
    }

    if (!cover && (opts?.allowNativeExtract ?? true)) {
      const extractedCover =
        await this.extractAndPersistCoverFromPdf(pdfFilename);
      if (extractedCover) {
        cover = extractedCover;
        if (!thumbBase64 || opts?.forceThumbRebuild) {
          thumbBase64 = await this.persistThumbFromCoverExport(
            pdfFilename,
            cover,
          );
        }
      }
    }

    const thumbDataUrl = thumbBase64
      ? `data:image/jpeg;base64,${thumbBase64}`
      : null;
    const coverDataUrl = cover
      ? `data:${cover.mimeType};base64,${cover.base64}`
      : null;

    if (thumbDataUrl) {
      this.setThumbCache(pdfFilename, thumbDataUrl);
    }

    return {
      coverDataUrl,
      thumbDataUrl,
      previewDataUrl: coverDataUrl ?? thumbDataUrl,
    };
  }

  async hasCoverExportForFilename(pdfFilename: string): Promise<boolean> {
    const baseName = this.getBaseNameFromPdfFilename(pdfFilename);
    const candidates = this.getCoverExportCandidates(baseName);
    for (const candidate of candidates) {
      const exists = await this.fileKit.exists({
        dir: 'Data',
        path: candidate.path,
      });
      if (exists) return true;
    }
    return false;
  }

  async getCoverFileSizeBytes(filename: string): Promise<number | null> {
    await this.ensurpdflicDocumentsPdfFolderReady();
    try {
      const bytes = await this.readPublicPdfBytes(filename);
      return bytes.byteLength;
    } catch {
      return null;
    }
  }

  async saveProjectSnapshot(opts: {
    coverFilename: string;
    sourceFile: File;
    coverFileForThumb: File;
    cropState: CoverCropState;
    target: { width: number; height: number };
    coverMetadata?: CoverProcessingMetadataInput;
    sourceInfo?: {
      name?: string;
      width?: number;
      height?: number;
      originalName?: string;
      originalWidth?: number;
      originalHeight?: number;
    };
  }): Promise<SaveProjectResult> {
    await this.ensureProjectFoldersReady();
    const coverFilename = this.ensurePdfExt(this.sanitizeFilename(opts.coverFilename));
    const baseName = this.getBaseNameFromPdfFilename(coverFilename);
    const sourceMimeType =
      opts.sourceFile.type || this.mimeFromFilename(opts.sourceFile.name);
    const sourceExt = this.coverExtFromMime(sourceMimeType);
    const sourceFilename = `${baseName}.source.${sourceExt}`;
    const projectFilename = `${baseName}.json`;
    const sourcePath = `${this.PROJECT_FOLDER}/${sourceFilename}`;
    const projectPath = `${this.PROJECT_FOLDER}/${projectFilename}`;
    const thumbPath = this.getProjectThumbPathForFilename(coverFilename);

    const snapshot: SavedCoverProject = {
      schemaVersion: 1,
      kind: 'pdf-cover-maker-project',
      savedAt: new Date().toISOString(),
      coverFilename,
      sourceFilename,
      sourceMimeType,
      cropState: opts.cropState,
      target: {
        width: Math.max(1, Math.round(opts.target.width)),
        height: Math.max(1, Math.round(opts.target.height)),
      },
      coverMetadata: opts.coverMetadata,
      sourceInfo: opts.sourceInfo,
    };

    const sourceBytes = new Uint8Array(await opts.sourceFile.arrayBuffer());
    await this.fileKit.writeBytes({
      dir: 'Data',
      path: sourcePath,
      bytes: sourceBytes,
      mimeType: sourceMimeType,
    });

    await this.fileKit.writeBytes({
      dir: 'Data',
      path: projectPath,
      bytes: new TextEncoder().encode(JSON.stringify(snapshot, null, 2)),
      mimeType: 'application/json',
    });

    await this.ensureProjectThumbFromFile(opts.coverFileForThumb, thumbPath);

    return {
      projectPath,
      sourcePath,
      thumbPath,
      filename: projectFilename,
    };
  }

  private async persistCoverAssetsFromFile(
    coverFile: File,
    pdfFilename: string,
  ) {
    const cover = await this.persistCoverExportFromFile(
      coverFile,
      pdfFilename,
    );
    const thumbBase64 = await this.arrayBufferToJpegThumbBase64(
      this.toStrictArrayBuffer(cover.bytes),
      cover.filename,
      this.THUMB_MAX_WIDTH,
      this.THUMB_QUALITY,
    );
    const thumbPath = this.getThumbPathForPdfFilename(pdfFilename);
    const thumbFilename = thumbPath.split('/').pop() || '';
    const thumbBytes = this.fileKit.fromBase64(thumbBase64);

    await this.fileKit.writeBytes({
      dir: 'Data',
      path: thumbPath,
      bytes: thumbBytes,
      mimeType: 'image/jpeg',
    });
    this.markThumbPresent(pdfFilename);
    this.setThumbCache(pdfFilename, `data:image/jpeg;base64,${thumbBase64}`);

    return { thumbPath, thumbFilename };
  }

  private async persistThumbFromCoverExport(
    pdfFilename: string,
    cover: { base64: string; mimeType: string; filename: string },
  ): Promise<string | null> {
    try {
      const coverBytes = this.base64ToUint8(cover.base64);
      const coverArrayBuffer = this.toStrictArrayBuffer(coverBytes);
      const thumbBase64 = await this.arrayBufferToJpegThumbBase64(
        coverArrayBuffer,
        cover.filename,
        this.THUMB_MAX_WIDTH,
        this.THUMB_QUALITY,
      );
      const thumbPath = this.getThumbPathForPdfFilename(pdfFilename);

      const thumbBytes = this.fileKit.fromBase64(thumbBase64);

      await this.fileKit.writeBytes({
        dir: 'Data',
        path: thumbPath,
        bytes: thumbBytes,
        mimeType: 'image/jpeg',
      });
      this.markThumbPresent(pdfFilename);
      this.setThumbCache(pdfFilename, `data:image/jpeg;base64,${thumbBase64}`);

      return thumbBase64;
    } catch {
      return null;
    }
  }

  private thumbCacheKey(filename: string): string {
    return (filename || '').trim().toLowerCase();
  }

  private getThumbCache(filename: string): string | null {
    return this.thumbDataUrlCache.get(this.thumbCacheKey(filename)) ?? null;
  }

  private setThumbCache(filename: string, dataUrl: string): void {
    this.thumbDataUrlCache.set(this.thumbCacheKey(filename), dataUrl);
  }

  private clearThumbCache(filename: string): void {
    this.thumbDataUrlCache.delete(this.thumbCacheKey(filename));
  }

  private renameThumbCache(fromFilename: string, toFilename: string): void {
    const cached = this.getThumbCache(fromFilename);
    if (!cached) {
      this.clearThumbCache(toFilename);
      return;
    }
    this.setThumbCache(toFilename, cached);
    this.clearThumbCache(fromFilename);
  }

  private getThumbFilenameFromPdfFilename(pdfFilename: string): string {
    return `${this.getBaseNameFromPdfFilename(pdfFilename)}.jpg`.toLowerCase();
  }

  private async getThumbFileNamesCache(): Promise<Set<string>> {
    if (this.thumbFileNamesCache) {
      return this.thumbFileNamesCache;
    }
    if (!this.thumbFileNamesCachePromise) {
      this.thumbFileNamesCachePromise = this.listDirectoryFileNames(
        this.THUMB_FOLDER,
        'Data',
      ).then((names) => {
        this.thumbFileNamesCache = new Set(
          names.map((name) => name.toLowerCase()),
        );
        return this.thumbFileNamesCache;
      });
    }
    return this.thumbFileNamesCachePromise;
  }

  private async hasThumbForFilename(pdfFilename: string): Promise<boolean> {
    const names = await this.getThumbFileNamesCache();
    return names.has(this.getThumbFilenameFromPdfFilename(pdfFilename));
  }

  private markThumbPresent(pdfFilename: string): void {
    if (!this.thumbFileNamesCache) return;
    this.thumbFileNamesCache.add(
      this.getThumbFilenameFromPdfFilename(pdfFilename),
    );
  }

  private markThumbMissing(pdfFilename: string): void {
    if (!this.thumbFileNamesCache) return;
    this.thumbFileNamesCache.delete(
      this.getThumbFilenameFromPdfFilename(pdfFilename),
    );
  }

  private renameThumbPresence(fromFilename: string, toFilename: string): void {
    if (!this.thumbFileNamesCache) return;
    const fromThumb = this.getThumbFilenameFromPdfFilename(fromFilename);
    const toThumb = this.getThumbFilenameFromPdfFilename(toFilename);
    if (this.thumbFileNamesCache.has(fromThumb)) {
      this.thumbFileNamesCache.delete(fromThumb);
      this.thumbFileNamesCache.add(toThumb);
      return;
    }
    this.thumbFileNamesCache.delete(toThumb);
  }

  private clearResolvedPreviewCache(filename: string): void {
    this.resolvedPreviewCache.delete(this.thumbCacheKey(filename));
    this.ditherMetadataCache.delete(this.thumbCacheKey(filename));
  }

  private renameResolvedPreviewCache(
    fromFilename: string,
    toFilename: string,
  ): void {
    const fromKey = this.thumbCacheKey(fromFilename);
    const toKey = this.thumbCacheKey(toFilename);
    const cached = this.resolvedPreviewCache.get(fromKey);
    if (cached) {
      this.resolvedPreviewCache.set(toKey, cached);
    } else {
      this.resolvedPreviewCache.delete(toKey);
    }
    this.resolvedPreviewCache.delete(fromKey);
  }

  private renameDitherMetadataCache(
    fromFilename: string,
    toFilename: string,
  ): void {
    const fromKey = this.thumbCacheKey(fromFilename);
    const toKey = this.thumbCacheKey(toFilename);
    const cached = this.ditherMetadataCache.get(fromKey);
    if (cached) {
      this.ditherMetadataCache.set(toKey, cached);
    } else {
      this.ditherMetadataCache.delete(toKey);
    }
    this.ditherMetadataCache.delete(fromKey);
  }

  private cacheResolvedCoverMetadata(
    filename: string,
    metadata?: CoverProcessingMetadataInput,
  ): void {
    const cacheKey = this.thumbCacheKey(filename);
    this.resolvedPreviewCache.delete(cacheKey);
    if (!metadata) {
      this.ditherMetadataCache.delete(cacheKey);
      return;
    }

    const colorMode = metadata.colorMode ?? 'color';
    const artifactReductionEnabled =
      metadata.artifactReductionEnabled ?? !!metadata.isDithered;
    const artifactReductionMode =
      metadata.artifactReductionMode ??
      (artifactReductionEnabled && colorMode === 'black-white'
        ? 'bw-dither'
        : 'none');
    const isDithered =
      artifactReductionMode !== 'none' || !!metadata.isDithered;

    this.ditherMetadataCache.set(cacheKey, {
      isDithered,
      colorMode,
      artifactReductionEnabled,
      artifactReductionMode,
      detectionSource: 'local-metadata',
      ditherAlgorithm:
        isDithered && metadata.ditherAlgorithm?.trim()
          ? metadata.ditherAlgorithm.trim()
          : isDithered
            ? 'floyd-steinberg'
            : null,
      renderKind: isDithered ? 'processed-dithered' : 'processed-standard',
    });
  }

  private async tryReadBase64FromFilesystem(
    path: string,
    dir: 'Data' | 'Documents' | 'Cache' = 'Data',
  ): Promise<string | null> {
    try {
      const { data } = await Filesystem.readFile({
        path,
        directory: this.mapDirectory(dir),
      });
      if (typeof data === 'string') {
        return this.normalizeBase64Data(data);
      }
      const ab = await data.arrayBuffer();
      return this.arrayBufferToBase64(ab);
    } catch {
      try {
        const bytes = await this.fileKit.readBytes({
          dir,
          path,
        });
        return this.fileKit.toBase64(bytes);
      } catch {
        return null;
      }
    }
  }

  private async coerceToBase64String(data: string | Blob): Promise<string> {
    if (typeof data === 'string') return data;

    const ab = await data.arrayBuffer();
    return this.arrayBufferToBase64(ab);
  }

  private arrayBufferToBase64(ab: ArrayBuffer): string {
    const bytes = new Uint8Array(ab);
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return btoa(binary);
  }

  private toStrictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const out = new Uint8Array(bytes.byteLength);
    out.set(bytes);
    return out.buffer;
  }

  private async arrayBufferToJpegThumbBase64(
    ab: ArrayBuffer,
    filename: string,
    maxWidth = 320,
    quality = 0.82,
  ): Promise<string> {
    const mime = this.mimeFromFilename(filename);
    const blob = new Blob([ab], { type: mime });
    const objectUrl: string = URL.createObjectURL(blob);

    try {
      const img = await this.urlToImage(objectUrl);

      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');

      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const b64 = dataUrl.split(',')[1] ?? '';
      if (!b64) throw new Error('Thumb encode failed');
      return b64;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private urlToImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = url;
    });
  }

  private mimeFromFilename(name: string): string {
    const ext = (name.split('.').pop() ?? '').toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  }

  private resolveProjectSourceMimeType(
    declaredMimeType: string | undefined,
    sourceFilename: string,
    sourceBytes: Uint8Array,
  ): string {
    const mime = (declaredMimeType ?? '').trim().toLowerCase();
    if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp') {
      return mime;
    }

    if (sourceBytes.length >= 12) {
      const isPng =
        sourceBytes[0] === 0x89 &&
        sourceBytes[1] === 0x50 &&
        sourceBytes[2] === 0x4e &&
        sourceBytes[3] === 0x47 &&
        sourceBytes[4] === 0x0d &&
        sourceBytes[5] === 0x0a &&
        sourceBytes[6] === 0x1a &&
        sourceBytes[7] === 0x0a;
      if (isPng) return 'image/png';

      const isJpeg =
        sourceBytes[0] === 0xff &&
        sourceBytes[1] === 0xd8 &&
        sourceBytes[2] === 0xff;
      if (isJpeg) return 'image/jpeg';

      const isWebp =
        sourceBytes[0] === 0x52 &&
        sourceBytes[1] === 0x49 &&
        sourceBytes[2] === 0x46 &&
        sourceBytes[3] === 0x46 &&
        sourceBytes[8] === 0x57 &&
        sourceBytes[9] === 0x45 &&
        sourceBytes[10] === 0x42 &&
        sourceBytes[11] === 0x50;
      if (isWebp) return 'image/webp';
    }

    return this.mimeFromFilename(sourceFilename);
  }

  private buildFilename(modelId: string) {
    const now = new Date();
    const safeTs =
      `${now.getFullYear()}` +
      `${String(now.getMonth() + 1).padStart(2, '0')}` +
      `${String(now.getDate()).padStart(2, '0')}_` +
      `${String(now.getHours()).padStart(2, '0')}` +
      `${String(now.getMinutes()).padStart(2, '0')}`;
    return `pdf_cover_${modelId}_${safeTs}.pdf`;
  }

  private ensurePdfExt(name: string) {
    return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
  }

  private sanitizeFilename(name: string) {
    const trimmed = (name ?? '').trim() || 'pdf_cover';
    return trimmed.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').slice(0, 120);
  }

  private coverExtFromMime(mime: string): 'jpg' | 'png' | 'webp' {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }

  private coverMediaTypeFromMime(mime: string): string {
    if (mime === 'image/png') return 'image/png';
    if (mime === 'image/webp') return 'image/webp';
    return 'image/jpeg';
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  private base64ToUint8(base64: string): Uint8Array {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  private async makeThumbnailBase64(
    file: File,
    maxWidth = 320,
    quality = 0.82,
  ): Promise<string> {
    const img = await this.fileToImage(file);

    const scale = Math.min(1, maxWidth / img.width);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');

    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const b64 = dataUrl.split(',')[1] ?? '';
    if (!b64) throw new Error('Thumbnail encode failed');
    return b64;
  }

  private fileToImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Invalid image'));
      };
      img.src = objectUrl;
    });
  }

  private getPdfLang(): string {
    const raw =
      this.translate.currentLang ||
      this.translate.defaultLang ||
      (typeof navigator !== 'undefined' ? navigator.language : '') ||
      'en';

    return this.normalizeLang(raw);
  }

  private normalizeLang(raw: string): string {
    const base = String(raw).trim().toLowerCase().split(/[-_]/)[0];

    if (base === 'es') return 'es';
    if (base === 'de') return 'de';
    if (base === 'fr') return 'fr';
    if (base === 'it') return 'it';
    if (base === 'pt') return 'pt';
    return 'en';
  }

  async generatePdfBytes(opts: {
    modelId: string;
    coverFile: File;
    title?: string;
    filename?: string;
  }): Promise<{ bytes: Uint8Array; filename: string }> {
    if (!this.pdfRewrite.isSupported()) {
      if (!this.webPdfCover) {
        throw new Error('Web PDF cover support not available in this build');
      }
      const filename = this.ensurePdfExt(
        this.sanitizeFilename(
          opts.filename ?? this.buildFilename(opts.modelId),
        ),
      );
      const bytes = await this.webPdfCover.createMinimalPdf(
        opts.coverFile,
        opts.title ?? 'PDF Cover',
        this.getPdfLang(),
      );
      return { bytes, filename };
    }

    const filename = this.ensurePdfExt(
      this.sanitizeFilename(opts.filename ?? this.buildFilename(opts.modelId)),
    );

    const coverMime =
      opts.coverFile.type || this.mimeFromFilename(opts.coverFile.name);
    const coverExt = this.coverExtFromMime(coverMime);
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempCoverPath = `${this.PDF_FOLDER}/tmp_cover_${nonce}.${coverExt}`;
    const tempOutputPath = `${this.PDF_FOLDER}/tmp_pdf_${nonce}.pdf`;

    try {
      const coverBytes = new Uint8Array(await opts.coverFile.arrayBuffer());
      await this.fileKit.writeBytes({
        dir: 'Cache',
        path: tempCoverPath,
        bytes: coverBytes,
        mimeType: this.coverMediaTypeFromMime(coverMime),
      });

      await this.fileKit.writeBytes({
        dir: 'Cache',
        path: tempOutputPath,
        bytes: new Uint8Array(),
        mimeType: 'application/pdf',
      });

      const coverUri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempCoverPath,
      });
      const outputUri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempOutputPath,
      });

      await this.pdfRewrite.createPdfFromCover({
        coverPath: coverUri,
        outputPath: outputUri,
        title: opts.title ?? 'PDF Cover',
        lang: this.getPdfLang(),
        appName: this.APP_NAME,
      });

      const bytes = await this.fileKit.readBytes({
        dir: 'Cache',
        path: tempOutputPath,
      });

      return { bytes, filename };
    } finally {
      await this.cleanupCachePaths([tempCoverPath, tempOutputPath]);
    }
  }

  async generatePdfBytesFromSource(opts: {
    sourcePdfFile: File;
    coverFile: File;
    filename?: string;
    coverMode?: 'replace' | 'insert';
  }): Promise<{ bytes: Uint8Array; filename: string }> {
    if (!this.pdfRewrite.isSupported()) {
      if (!this.webPdfCover) {
        throw new Error('Web PDF cover support not available in this build');
      }
      const filename = this.ensurePdfExt(
        this.sanitizeFilename(
          opts.filename ?? opts.sourcePdfFile?.name ?? 'pdf_cover.pdf',
        ),
      );
      const bytes = await this.webPdfCover.replaceCover(
        opts.sourcePdfFile,
        opts.coverFile,
        filename,
        opts.coverMode,
      );
      return { bytes, filename };
    }

    const sourceName = opts.sourcePdfFile?.name || 'pdf_cover.pdf';
    const filename = this.ensurePdfExt(
      this.sanitizeFilename(opts.filename ?? sourceName),
    );
    const coverMime =
      opts.coverFile.type || this.mimeFromFilename(opts.coverFile.name);
    const coverExt = this.coverExtFromMime(coverMime);
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempSourcePath = `${this.PDF_FOLDER}/tmp_source_${nonce}.pdf`;
    const tempCoverPath = `${this.PDF_FOLDER}/tmp_cover_${nonce}.${coverExt}`;
    const tempOutputPath = `${this.PDF_FOLDER}/tmp_output_${nonce}.pdf`;

    try {
      const [sourceBytes, coverBytes] = await Promise.all([
        opts.sourcePdfFile.arrayBuffer(),
        opts.coverFile.arrayBuffer(),
      ]);

      await Promise.all([
        this.fileKit.writeBytes({
          dir: 'Cache',
          path: tempSourcePath,
          bytes: new Uint8Array(sourceBytes),
          mimeType: 'application/pdf',
        }),
        this.fileKit.writeBytes({
          dir: 'Cache',
          path: tempCoverPath,
          bytes: new Uint8Array(coverBytes),
          mimeType: this.coverMediaTypeFromMime(coverMime),
        }),
        this.fileKit.writeBytes({
          dir: 'Cache',
          path: tempOutputPath,
          bytes: new Uint8Array(),
          mimeType: 'application/pdf',
        }),
      ]);

      const [sourceUri, coverUri, outputUri] = await Promise.all([
        this.fileKit.getUri({ dir: 'Cache', path: tempSourcePath }),
        this.fileKit.getUri({ dir: 'Cache', path: tempCoverPath }),
        this.fileKit.getUri({ dir: 'Cache', path: tempOutputPath }),
      ]);

      const inspected = await this.pdfRewrite.inspectPdf(sourceUri);
      if (!inspected.valid) {
        throw new PdfRewriteError(inspected.errorCode ?? 'PDF_CORRUPT');
      }

      const rewritten = await this.pdfRewrite.rewriteCover({
        inputPath: sourceUri,
        outputPath: outputUri,
        newCoverPath: coverUri,
        mode: opts.coverMode,
      });

      if (!rewritten.success) {
        throw new PdfRewriteError(rewritten.error ?? 'REWRITE_FAILED', {
          message: rewritten.message,
          stage: rewritten.stage,
        });
      }

      const bytes = await this.fileKit.readBytes({
        dir: 'Cache',
        path: tempOutputPath,
      });

      return { bytes, filename };
    } finally {
      await this.cleanupCachePaths([
        tempSourcePath,
        tempCoverPath,
        tempOutputPath,
      ]);
    }
  }

  async saveGeneratedPdf(opts: {
    bytes: Uint8Array;
    filename: string;
    coverFileForThumb: File;
    coverMetadata?: CoverProcessingMetadataInput;
    overwriteExisting?: boolean;
  }) {
    const filename = this.ensurePdfExt(this.sanitizeFilename(opts.filename));
    const finalBytes = await this.applyCoverMetadataToPdfBytes(
      opts.bytes,
      opts.coverMetadata,
    );
    const outputFilename = opts.overwriteExisting
      ? filename
      : await this.getUniqueDocumentFilename(filename);
    const pdfPath = `${this.PDF_FOLDER}/${outputFilename}`;

    if (!this.pdfRewrite.isSupported()) {
      await this.fileKit.writeBytes({
        dir: 'Documents',
        path: pdfPath,
        bytes: finalBytes,
        mimeType: 'application/pdf',
      });

      const uri = await this.fileKit.getUri({
        dir: 'Documents',
        path: pdfPath,
      });

      const assets = await this.persistCoverAssetsFromFile(
        opts.coverFileForThumb,
        outputFilename,
      );
      this.clearResolvedPreviewCache(outputFilename);

      this.debugLog('saveGeneratedPdf:web:documents', {
        filename: outputFilename,
        bytes: finalBytes.byteLength,
        path: pdfPath,
      });

      return {
        path: pdfPath,
        uri,
        filename: outputFilename,
        thumbPath: assets.thumbPath,
        thumbFilename: assets.thumbFilename,
      };
    }

    await this.writpdflicPdf(outputFilename, finalBytes);
    this.debugLog('saveGeneratedPdf:finalWriteComplete', {
      filename: outputFilename,
      writeCompletedAt: new Date().toISOString(),
      bytes: finalBytes.byteLength,
    });
    const uri = await this.getPublicPdfFileUriOrThrow(outputFilename);
    this.debugLog('saveGeneratedPdf', {
      filename: outputFilename,
      bytes: finalBytes.byteLength,
    });

    const assets = await this.persistCoverAssetsFromFile(
      opts.coverFileForThumb,
      outputFilename,
    );
    this.cacheResolvedCoverMetadata(outputFilename, opts.coverMetadata);

    return {
      path: pdfPath,
      uri,
      filename: outputFilename,
      thumbPath: assets.thumbPath,
      thumbFilename: assets.thumbFilename,
    };
  }
  async saveGeneratedPdfFromPath(opts: {
    sourcePath: string;
    sourceDir: 'Data' | 'Documents' | 'Cache';
    filename: string;
    coverFileForThumb: File;
    coverMetadata?: CoverProcessingMetadataInput;
    overwriteExisting?: boolean;
  }) {
    const filename = this.ensurePdfExt(this.sanitizeFilename(opts.filename));
    const outputFilename = opts.overwriteExisting
      ? filename
      : await this.getUniqueDocumentFilename(filename);
    const pdfPath = `${this.PDF_FOLDER}/${outputFilename}`;

    const bytes = await this.readBytesFromSource(
      opts.sourcePath,
      opts.sourceDir,
    );
    const finalBytes = await this.applyCoverMetadataToPdfBytes(
      bytes,
      opts.coverMetadata,
    );
    await this.writpdflicPdf(outputFilename, finalBytes);
    this.debugLog('saveGeneratedPdfFromPath:finalWriteComplete', {
      filename: outputFilename,
      writeCompletedAt: new Date().toISOString(),
      bytes: finalBytes.byteLength,
      sourceDir: opts.sourceDir,
      sourcePath: opts.sourcePath,
    });
    const uri = await this.getPublicPdfFileUriOrThrow(outputFilename);
    this.debugLog('saveGeneratedPdfFromPath', {
      sourceDir: opts.sourceDir,
      sourcePath: opts.sourcePath,
      filename: outputFilename,
      bytes: finalBytes.byteLength,
    });

    const assets = await this.persistCoverAssetsFromFile(
      opts.coverFileForThumb,
      outputFilename,
    );
    this.cacheResolvedCoverMetadata(outputFilename, opts.coverMetadata);

    return {
      path: pdfPath,
      uri,
      filename: outputFilename,
      thumbPath: assets.thumbPath,
      thumbFilename: assets.thumbFilename,
    };
  }

  async reserveNativeDocumentOutput(
    requestedFilename: string,
    opts?: GeneratedFileSaveOptions,
  ): Promise<NativeDocumentOutputTarget> {
    const filename = this.ensurePdfExt(
      this.sanitizeFilename(requestedFilename),
    );
    const outputFilename = opts?.overwriteExisting
      ? filename
      : await this.getUniqueDocumentFilename(filename);
    const relativePath = `${this.PDF_FOLDER}/${outputFilename}`;
    await this.ensurpdflicDocumentsPdfFolderReady();
    const nativePath = this.publicDocumentsPdfPath(outputFilename);

    return {
      filename: outputFilename,
      relativePath,
      nativePath,
    };
  }

  async persistCoverAssetsForGeneratedFilename(opts: {
    filename: string;
    coverFileForThumb: File;
    coverMetadata?: CoverProcessingMetadataInput;
  }): Promise<{ thumbPath: string; thumbFilename: string }> {
    await this.ensurpdflicDocumentsPdfFolderReady();
    await this.updateGeneratedPdfMetadata(opts.filename, opts.coverMetadata);
    const assets = await this.persistCoverAssetsFromFile(
      opts.coverFileForThumb,
      opts.filename,
    );
    this.cacheResolvedCoverMetadata(opts.filename, opts.coverMetadata);
    return assets;
  }

  async saveGeneratedPdfFromExistingDocument(opts: {
    sourceFilename: string;
    filename: string;
    coverFileForThumb: File;
    coverMetadata?: CoverProcessingMetadataInput;
    overwriteExisting?: boolean;
  }) {
    await this.ensurpdflicDocumentsPdfFolderReady();
    const sourceFilename = this.ensurePdfExt(
      this.sanitizeFilename(opts.sourceFilename),
    );
    const sourcePath = `${this.PDF_FOLDER}/${sourceFilename}`;

    const filename = this.ensurePdfExt(this.sanitizeFilename(opts.filename));
    const outputFilename = opts.overwriteExisting
      ? filename
      : await this.getUniqueDocumentFilename(filename, '.pdf', {
          ignoreFilename: sourceFilename,
        });
    const pdfPath = `${this.PDF_FOLDER}/${outputFilename}`;

    if (sourcePath !== pdfPath) {
      const bytes = await this.readPublicPdfBytes(sourceFilename);
      const finalBytes = await this.applyCoverMetadataToPdfBytes(
        bytes,
        opts.coverMetadata,
      );
      await this.writpdflicPdf(outputFilename, finalBytes);
      this.debugLog(
        'saveGeneratedPdfFromExistingDocument:finalWriteComplete',
        {
          filename: outputFilename,
          writeCompletedAt: new Date().toISOString(),
          bytes: finalBytes.byteLength,
        },
      );
    }

    if (sourcePath === pdfPath) {
      await this.updateGeneratedPdfMetadata(
        outputFilename,
        opts.coverMetadata,
      );
    }

    const uri = await this.getPublicPdfFileUriOrThrow(outputFilename);
    this.debugLog('saveGeneratedPdfFromExistingDocument', {
      sourceFilename,
      filename: outputFilename,
      copied: sourcePath !== pdfPath,
    });

    const assets = await this.persistCoverAssetsFromFile(
      opts.coverFileForThumb,
      outputFilename,
    );
    this.cacheResolvedCoverMetadata(outputFilename, opts.coverMetadata);

    return {
      path: pdfPath,
      uri,
      filename: outputFilename,
      thumbPath: assets.thumbPath,
      thumbFilename: assets.thumbFilename,
    };
  }

  async renameGeneratedPdf(opts: { from: string; to: string }) {
    await this.ensurpdflicDocumentsPdfFolderReady();
    const fromFilename = this.ensurePdfExt(this.sanitizeFilename(opts.from));
    const toFilenameRaw = this.ensurePdfExt(this.sanitizeFilename(opts.to));
    const toFilename = await this.getUniqueDocumentFilename(
      toFilenameRaw,
      '.pdf',
      {
        ignoreFilename: fromFilename,
      },
    );

    if (fromFilename === toFilename) {
      return {
        filename: toFilename,
        path: `${this.PDF_FOLDER}/${toFilename}`,
        thumbPath: this.getThumbPathForPdfFilename(toFilename),
      };
    }

    const fromPath = `${this.PDF_FOLDER}/${fromFilename}`;
    const toPath = `${this.PDF_FOLDER}/${toFilename}`;

    const exists = await this.existsInPublicDocuments(fromFilename);

    if (!exists) {
      throw new Error(`File not found: ${fromPath}`);
    }

    await Filesystem.rename({
      from: this.publicDocumentsPdfPath(fromFilename),
      to: this.publicDocumentsPdfPath(toFilename),
    });
    await this.deleteDocumentPdfIfExists(fromPath);
    this.debugLog('renameGeneratedPdf', {
      from: fromFilename,
      to: toFilename,
    });

    const fromThumbPath = this.getThumbPathForPdfFilename(fromFilename);
    const toThumbPath = this.getThumbPathForPdfFilename(toFilename);
    const thumbExists = await this.fileKit.exists({
      dir: 'Data',
      path: fromThumbPath,
    });

    if (thumbExists) {
      await Filesystem.rename({
        from: fromThumbPath,
        to: toThumbPath,
        directory: Directory.Data,
        toDirectory: Directory.Data,
      });
    }

    const fromCoverBase = this.getBaseNameFromPdfFilename(fromFilename);
    const toCoverBase = this.getBaseNameFromPdfFilename(toFilename);
    const fromCovers = this.getCoverExportCandidates(fromCoverBase);
    const toCovers = this.getCoverExportCandidates(toCoverBase);

    for (const fromCover of fromCovers) {
      const exists = await this.fileKit.exists({
        dir: 'Data',
        path: fromCover.path,
      });
      if (!exists) continue;

      const toCover = toCovers.find(
        (candidate) => candidate.ext === fromCover.ext,
      );
      if (!toCover) continue;

      await Filesystem.rename({
        from: fromCover.path,
        to: toCover.path,
        directory: Directory.Data,
        toDirectory: Directory.Data,
      });
    }
    this.renameThumbCache(fromFilename, toFilename);
    this.renameThumbPresence(fromFilename, toFilename);
    this.renameResolvedPreviewCache(fromFilename, toFilename);
    this.renameDitherMetadataCache(fromFilename, toFilename);
    await this.renameProjectSnapshotAssets(fromFilename, toFilename);

    return {
      filename: toFilename,
      path: toPath,
      thumbPath: toThumbPath,
    };
  }

  async existsInDocuments(path: string): Promise<boolean> {
    const filename = path.split('/').pop() || path;
    return this.existsInPublicDocuments(filename);
  }

  async getUniqueDocumentFilename(
    baseName: string,
    ext = '.pdf',
    opts?: { ignoreFilename?: string },
  ): Promise<string> {
    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const sanitized = this.ensurePdfExt(this.sanitizeFilename(baseName));
    let base = sanitized.replace(
      new RegExp(`${cleanExt.replace('.', '\\.')}$`, 'i'),
      '',
    );
    base = base.trim() || 'pdf_cover';

    const ignore = opts?.ignoreFilename?.toLowerCase?.() ?? null;
    let candidate = `${base}${cleanExt}`;
    let idx = 1;
    while (true) {
      const exists = await this.existsInPublicDocuments(candidate);
      if (!exists || (ignore && candidate.toLowerCase() === ignore)) {
        return candidate;
      }
      candidate = `${base} (${idx})${cleanExt}`;
      idx += 1;
    }
  }

  async deleteGeneratedPdf(filename: string) {
    await this.deleteCoverByFilename(filename);
  }

  async shareGeneratedPdfFromPath(opts: {
    sourcePath: string;
    sourceDir: 'Data' | 'Documents' | 'Cache';
    filename: string;
    title?: string;
  }) {
    const filename = this.ensurePdfExt(this.sanitizeFilename(opts.filename));
    const cachePath = `${this.PDF_FOLDER}/${filename}`;

    try {
      await this.fileKit.delete({
        dir: 'Cache',
        path: cachePath,
      });
    } catch {
      // cache file may not exist yet
    }

    await Filesystem.copy({
      from: opts.sourcePath,
      directory: this.mapDirectory(opts.sourceDir),
      to: cachePath,
      toDirectory: Directory.Cache,
    });

    const uri = await this.fileKit.getUri({
      dir: 'Cache',
      path: cachePath,
    });

    const fileRef: FileRef = {
      uri,
      filename,
      mimeType: 'application/pdf',
    };

    await this.fileKit.share(fileRef, {
      title: opts.title ?? 'PDF Cover',
      dialogTitle: 'Share PDF',
    });

    return { uri, filename };
  }

  async shareGeneratedPdf(opts: {
    bytes: Uint8Array;
    filename: string;
    title?: string;
  }) {
    const filename = this.ensurePdfExt(this.sanitizeFilename(opts.filename));
    const cachePath = `${this.PDF_FOLDER}/${filename}`;

    // Use file-kit to write to cache
    const pdfRef = await this.fileKit.writeBytes({
      dir: 'Cache',
      path: cachePath,
      bytes: opts.bytes,
      mimeType: 'application/pdf',
    });

    // Use file-kit to share
    await this.fileKit.share(pdfRef, {
      title: opts.title ?? 'PDF Cover',
      dialogTitle: 'Share PDF',
    });

    return { uri: pdfRef.uri, filename };
  }

  async getCoverDataUrlForFilename(
    pdfFilename: string,
  ): Promise<string | null> {
    const preview = await this.getBestPreviewCoverDataUrl(pdfFilename);
    return preview.dataUrl;
  }

  private async persistCoverExportFromFile(
    coverFile: File,
    pdfFilename: string,
  ) {
    const ext = this.coverExtFromMime(
      coverFile.type || this.mimeFromFilename(coverFile.name),
    );
    const filename = `${this.getBaseNameFromPdfFilename(pdfFilename)}.${ext}`;
    const coverPath = `${this.COVER_FOLDER}/${filename}`;
    const mimeType = this.coverMediaTypeFromMime(coverFile.type);
    const bytes = new Uint8Array(await coverFile.arrayBuffer());

    await this.fileKit.writeBytes({
      dir: 'Data',
      path: coverPath,
      bytes,
      mimeType,
    });

    await this.removeOtherCoverExportVariants(pdfFilename, ext);

    return { coverPath, filename, mimeType, bytes };
  }

  private async readCoverExport(pdfFilename: string): Promise<{
    path: string;
    filename: string;
    base64: string;
    mimeType: string;
  } | null> {
    const baseName = this.getBaseNameFromPdfFilename(pdfFilename);
    const candidates = this.getCoverExportCandidates(baseName);

    for (const candidate of candidates) {
      const exists = await this.fileKit.exists({
        dir: 'Data',
        path: candidate.path,
      });
      if (!exists) continue;
      const base64 = await this.tryReadBase64FromFilesystem(candidate.path);
      if (!base64) continue;
      return {
        path: candidate.path,
        filename: candidate.filename,
        base64,
        mimeType: candidate.mimeType,
      };
    }

    return null;
  }

  private async extractAndPersistCoverFromPdf(pdfFilename: string): Promise<{
    path: string;
    filename: string;
    base64: string;
    mimeType: string;
  } | null> {
    if (!this.pdfRewrite.isSupported()) return null;

    try {
      const pdfUri = await this.getPublicPdfUri(pdfFilename);

      const extracted = await this.pdfRewrite.extractFirstPagePreviewFile({
        inputPath: pdfUri,
        pdfName: pdfFilename,
        maxDimension: 1600,
      });

      await this.persistCoverAssetsFromFile(extracted.file, pdfFilename);
      return this.readCoverExport(pdfFilename);
    } catch (error) {
      console.warn(
        `[file.service] Native cover extraction failed for ${pdfFilename}:`,
        error,
      );
      return null;
    }
  }

  private getCoverExportCandidates(baseName: string): Array<{
    path: string;
    filename: string;
    mimeType: string;
    ext: 'jpg' | 'png' | 'webp';
  }> {
    const variants: Array<{ ext: 'jpg' | 'png' | 'webp'; mimeType: string }> = [
      { ext: 'jpg', mimeType: 'image/jpeg' },
      { ext: 'png', mimeType: 'image/png' },
      { ext: 'webp', mimeType: 'image/webp' },
    ];

    return variants.map((variant) => {
      const filename = `${baseName}.${variant.ext}`;
      return {
        ...variant,
        filename,
        path: `${this.COVER_FOLDER}/${filename}`,
      };
    });
  }

  private async removeOtherCoverExportVariants(
    pdfFilename: string,
    keepExt: 'jpg' | 'png' | 'webp',
  ): Promise<void> {
    const baseName = this.getBaseNameFromPdfFilename(pdfFilename);
    const candidates = this.getCoverExportCandidates(baseName).filter(
      (candidate) => candidate.ext !== keepExt,
    );

    for (const candidate of candidates) {
      try {
        await this.fileKit.delete({
          dir: 'Data',
          path: candidate.path,
        });
      } catch {
        // best effort cleanup
      }
    }
  }

  private getBaseNameFromPdfFilename(pdfFilename: string): string {
    return pdfFilename.replace(/\.pdf$/i, '');
  }

  private normalizeBase64Data(data: string): string {
    const commaIdx = data.indexOf(',');
    if (commaIdx > -1) {
      return data.slice(commaIdx + 1);
    }
    return data;
  }

  private async listDirectoryFileNames(
    path: string,
    dir: 'Data' | 'Documents' | 'Cache',
  ): Promise<string[]> {
    try {
      const list = await Filesystem.readdir({
        path,
        directory: this.mapDirectory(dir),
      });
      return (list.files ?? [])
        .map((entry) => (typeof entry === 'string' ? entry : entry.name))
        .filter((name): name is string => !!name);
    } catch (error) {
      console.warn('[ECC:file.service] listDirectoryFileNames failed', {
        path,
        dir,
        error: this.errorDetails(error),
      });
      return [];
    }
  }

  private publicDocumentsPdfPath(filename: string): string {
    return this.pdfStore.pathFor(filename);
  }

  private async listPdfsFromPublicDocuments(): Promise<string[]> {
    this.debugLog('listPdfsFromPublicDocuments:start', {
      reloadAt: new Date().toISOString(),
      resolvedFolderPath: this.pdfStore.publicFolderPath,
      pathCandidates: this.pdfStore.publicFolderPaths,
    });
    const files = await this.pdfStore.listPdfs();
    const result = Array.from(files).sort((a, b) => a.localeCompare(b));

    this.debugLog('listPdfsFromPublicDocuments:done', {
      count: result.length,
      files: result,
    });
    return result;
  }

  private async listDirectoryDocumentsPdfs(): Promise<string[]> {
    const files = await this.listDirectoryFileNames(
      this.PDF_FOLDER,
      'Documents',
    );
    return files
      .filter((name) => name.toLowerCase().endsWith('.pdf'))
      .sort((a, b) => a.localeCompare(b));
  }

  private async writpdflicPdf(
    filename: string,
    bytes: Uint8Array,
  ): Promise<void> {
    await this.pdfStore.writePdf(filename, bytes);
  }

  private async deletpdflicPdf(filename: string): Promise<void> {
    await this.pdfStore.deletePdf(filename);
  }

  private async deleteDocumentPdfIfExists(
    relativePath: string,
  ): Promise<void> {
    await this.pdfStore.deleteDocumentPdfIfExists(relativePath);
  }

  private async existsInPublicDocuments(filename: string): Promise<boolean> {
    return this.pdfStore.exists(filename);
  }

  private async readPublicPdfBytes(filename: string): Promise<Uint8Array> {
    return this.pdfStore.readBytes(filename);
  }

  private async getPublicPdfFileUriOrThrow(filename: string): Promise<string> {
    const uri = await this.pdfStore.getUriOrThrow(filename);
    this.debugLog('getPublicPdfFileUriOrThrow', { filename, uri });
    return uri;
  }

  private async getPublicPdfUri(filename: string): Promise<string> {
    return this.getPublicPdfFileUriOrThrow(filename);
  }

  private async stagePublicPdfForShare(filename: string): Promise<FileRef> {
    const sourceUri = await this.getPublicPdfFileUriOrThrow(filename);
    const sourcePath = this.normalizeUriToPath(sourceUri);
    const shareFolderPath = `${this.PDF_FOLDER}/share`;
    const stagedPath = `${shareFolderPath}/${filename}`;

    try {
      await Filesystem.mkdir({
        directory: Directory.Cache,
        path: shareFolderPath,
        recursive: true,
      });
    } catch (error) {
      // Capacitor Filesystem can throw if the directory already exists.
      // That state is valid for staging shared/opened files.
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
    }

    try {
      try {
        await this.fileKit.delete({ dir: 'Cache', path: stagedPath });
      } catch {
        // expected when staging file is not present
      }

      await Filesystem.copy({
        from: sourcePath,
        to: stagedPath,
        toDirectory: Directory.Cache,
      });
      const uri = await this.fileKit.getUri({
        dir: 'Cache',
        path: stagedPath,
      });

      return {
        uri,
        filename,
        mimeType: 'application/pdf',
      };
    } catch (error) {
      this.debugLog('stagePublicPdfForShare:fallbackToSourceUri', {
        filename,
        sourceUri,
        error: this.errorDetails(error),
      });
      return {
        uri: sourceUri,
        filename,
        mimeType: 'application/pdf',
      };
    }
  }

  private normalizeUriToPath(uri: string): string {
    if (!uri.toLowerCase().startsWith('file://')) {
      return uri;
    }
    const withoutScheme = uri.slice('file://'.length);
    return withoutScheme.replace(/^\/+/, '/');
  }

  private async resolveDitherMetadata(
    filename: string,
    previewSrc: string,
    opts?: { forceRefresh?: boolean },
  ): Promise<ResolvedDitherMetadata> {
    const cacheKey = this.thumbCacheKey(filename);
    if (!opts?.forceRefresh) {
      const cached = this.ditherMetadataCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const embedded = await this.readEmbeddedDitherMetadata(filename);
    if (embedded) {
      this.ditherMetadataCache.set(cacheKey, embedded);
      return embedded;
    }

    const analysis = await analyzeDitherPreview(previewSrc);
    const inferred: ResolvedDitherMetadata = {
      isDithered: !!analysis?.isDithered,
      colorMode: analysis?.isDithered ? 'black-white' : 'color',
      artifactReductionEnabled: false,
      artifactReductionMode: 'none',
      detectionSource: 'inferred',
      ditherAlgorithm: analysis?.isDithered ? 'floyd-steinberg' : null,
      width: analysis?.width,
      height: analysis?.height,
    };
    this.ditherMetadataCache.set(cacheKey, inferred);
    return inferred;
  }

  private async readEmbeddedDitherMetadata(
    _filename: string,
  ): Promise<ResolvedDitherMetadata | null> {
    return null;
  }

  private async applyCoverMetadataToPdfBytes(
    bytes: Uint8Array,
    _metadata?: CoverProcessingMetadataInput,
  ): Promise<Uint8Array> {
    return bytes;
  }

  private async updateGeneratedPdfMetadata(
    _filename: string,
    _metadata?: CoverProcessingMetadataInput,
  ): Promise<void> {
    return;
  }

  private async ensurpdflicDocumentsPdfFolderReady(opts?: {
    skipLegacyMigration?: boolean;
  }): Promise<void> {
    await this.pdfStore.ensureReady();
    if (opts?.skipLegacyMigration) {
      this.startLegacyMigrationInBackground();
    } else {
      await this.migrateLegacyPdfFoldersOnce();
    }
    this.debugLog('ensurpdflicDocumentsPdfFolderReady', {
      resolvedFolderPath: this.pdfStore.publicFolderPath,
      pathCandidates: this.pdfStore.publicFolderPaths,
    });
  }

  private startLegacyMigrationInBackground(): void {
    if (
      this.hasMigratedLegacyPdfFolders ||
      this.legacyMigrationBackgroundPromise
    ) {
      return;
    }

    this.legacyMigrationBackgroundPromise = this.migrateLegacyPdfFoldersOnce()
      .catch((error) => {
        this.debugLog('migrateLegacyPdfFoldersOnce:backgroundFailed', {
          error: this.errorDetails(error),
        });
      })
      .finally(() => {
        this.legacyMigrationBackgroundPromise = null;
      });
  }

  private async migrateLegacyPdfFoldersOnce(): Promise<void> {
    if (this.hasMigratedLegacyPdfFolders) {
      return;
    }
    this.hasMigratedLegacyPdfFolders = true;

    const migrated: string[] = [];
    const failed: string[] = [];

    for (const legacyStore of this.legacyPdfStores) {
      let legacyFiles: string[] = [];

      try {
        await legacyStore.ensureReady();
        legacyFiles = await legacyStore.listPdfs();
      } catch (error) {
        this.debugLog('migrateLegacyPdfFoldersOnce:listFailed', {
          legacyFolder: legacyStore.folder,
          error: this.errorDetails(error),
        });
        continue;
      }

      for (const filename of legacyFiles) {
        try {
          const alreadyExists = await this.existsInPublicDocuments(filename);
          if (alreadyExists) {
            continue;
          }

          const bytes = await legacyStore.readBytes(filename);
          await this.writpdflicPdf(filename, bytes);
          migrated.push(filename);
        } catch (error) {
          failed.push(filename);
          this.debugLog('migrateLegacyPdfFoldersOnce:copyFailed', {
            legacyFolder: legacyStore.folder,
            filename,
            error: this.errorDetails(error),
          });
        }
      }
    }

    this.debugLog('migrateLegacyPdfFoldersOnce:done', {
      migratedCount: migrated.length,
      migrated,
      failedCount: failed.length,
      failed,
    });
  }

  private async readBytesFromSource(
    path: string,
    dir: 'Data' | 'Documents' | 'Cache',
  ): Promise<Uint8Array> {
    return this.fileKit.readBytes({ dir, path });
  }

  private async cleanupCachePaths(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async (path) => {
        try {
          await this.fileKit.delete({ dir: 'Cache', path });
        } catch {
          // best effort cleanup
        }
      }),
    );
  }

  private async readProjectSnapshotByFilename(
    filename: string,
  ): Promise<SavedCoverProject | null> {
    await this.ensureProjectFoldersReady();
    const normalized = filename.endsWith('.json') ? filename : `${filename}.json`;
    const projectPath = `${this.PROJECT_FOLDER}/${normalized}`;
    try {
      const bytes = await this.fileKit.readBytes({
        dir: 'Data',
        path: projectPath,
      });
      const text = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(text) as SavedCoverProject;
      if (
        !parsed ||
        parsed.kind !== 'pdf-cover-maker-project' ||
        parsed.schemaVersion !== 1 ||
        !parsed.coverFilename ||
        !parsed.sourceFilename ||
        !parsed.sourceMimeType ||
        !parsed.cropState ||
        !parsed.target
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async listProjectJsonFiles(): Promise<string[]> {
    await this.ensureProjectFoldersReady();
    const files = await this.listDirectoryFileNames(this.PROJECT_FOLDER, 'Data');
    return files
      .filter((name) => name.toLowerCase().endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));
  }

  private async deleteProjectSnapshotAssets(baseName: string): Promise<void> {
    await this.ensureProjectFoldersReady();
    const projectFiles = await this.listDirectoryFileNames(
      this.PROJECT_FOLDER,
      'Data',
    );
    for (const filename of projectFiles) {
      if (
        filename === `${baseName}.json` ||
        filename === `${baseName}.source.jpg` ||
        filename === `${baseName}.source.png` ||
        filename === `${baseName}.source.webp` ||
        filename.startsWith(`${baseName}.source.`)
      ) {
        try {
          await this.fileKit.delete({
            dir: 'Data',
            path: `${this.PROJECT_FOLDER}/${filename}`,
          });
        } catch {
          // ignore missing project asset
        }
      }
    }
    await this.fileKit.delete({
      dir: 'Data',
      path: `${this.PROJECT_THUMB_FOLDER}/${baseName}.jpg`,
    }).catch(() => {
      // ignore missing thumb
    });
  }

  private async renameProjectSnapshotAssets(
    fromFilename: string,
    toFilename: string,
  ): Promise<void> {
    await this.ensureProjectFoldersReady();
    const fromBaseName = this.getBaseNameFromPdfFilename(fromFilename);
    const toBaseName = this.getBaseNameFromPdfFilename(toFilename);
    const snapshot = await this.readProjectSnapshotByFilename(
      `${fromBaseName}.json`,
    );
    if (!snapshot) {
      return;
    }

    const updated: SavedCoverProject = {
      ...snapshot,
      savedAt: new Date().toISOString(),
      coverFilename: toFilename,
      sourceFilename: snapshot.sourceFilename.startsWith(`${fromBaseName}.`)
        ? snapshot.sourceFilename.replace(`${fromBaseName}.`, `${toBaseName}.`)
        : snapshot.sourceFilename,
    };

    const fromProjectPath = `${this.PROJECT_FOLDER}/${fromBaseName}.json`;
    const toProjectPath = `${this.PROJECT_FOLDER}/${toBaseName}.json`;
    const sourceExt = snapshot.sourceFilename.split('.').pop() ?? 'jpg';
    const fromSourcePath = `${this.PROJECT_FOLDER}/${snapshot.sourceFilename}`;
    const toSourcePath = `${this.PROJECT_FOLDER}/${updated.sourceFilename}`;
    const thumbFromPath = `${this.PROJECT_THUMB_FOLDER}/${fromBaseName}.jpg`;
    const thumbToPath = `${this.PROJECT_THUMB_FOLDER}/${toBaseName}.jpg`;

    try {
      const sourceExists = await this.fileKit.exists({
        dir: 'Data',
        path: fromSourcePath,
      });
      if (sourceExists && fromSourcePath !== toSourcePath) {
        const sourceBytes = await this.fileKit.readBytes({
          dir: 'Data',
          path: fromSourcePath,
        });
        await this.fileKit.writeBytes({
          dir: 'Data',
          path: toSourcePath,
          bytes: sourceBytes,
          mimeType: this.mimeFromFilename(sourceExt),
        });
        await this.fileKit.delete({
          dir: 'Data',
          path: fromSourcePath,
        }).catch(() => undefined);
      }
    } catch {
      // best effort
    }

    await this.fileKit.writeBytes({
      dir: 'Data',
      path: toProjectPath,
      bytes: new TextEncoder().encode(JSON.stringify(updated, null, 2)),
      mimeType: 'application/json',
    });
    await this.fileKit.delete({
      dir: 'Data',
      path: fromProjectPath,
    }).catch(() => undefined);

    try {
      const thumbExists = await this.fileKit.exists({
        dir: 'Data',
        path: thumbFromPath,
      });
      if (thumbExists && thumbFromPath !== thumbToPath) {
        const thumbBytes = await this.fileKit.readBytes({
          dir: 'Data',
          path: thumbFromPath,
        });
        await this.fileKit.writeBytes({
          dir: 'Data',
          path: thumbToPath,
          bytes: thumbBytes,
          mimeType: 'image/jpeg',
        });
        await this.fileKit.delete({
          dir: 'Data',
          path: thumbFromPath,
        }).catch(() => undefined);
      }
    } catch {
      // best effort
    }
  }

  private async ensureProjectThumbFromFile(
    file: File,
    thumbPath: string,
  ): Promise<void> {
    const thumbBase64 = await this.arrayBufferToJpegThumbBase64(
      await file.arrayBuffer(),
      file.name,
      this.THUMB_MAX_WIDTH,
      this.THUMB_QUALITY,
    );
    await this.fileKit.writeBytes({
      dir: 'Data',
      path: thumbPath,
      bytes: this.fileKit.fromBase64(thumbBase64),
      mimeType: 'image/jpeg',
    });
  }

  private async ensureProjectFoldersReady(): Promise<void> {
    await ensureDirectoriesExist([
      this.PROJECT_FOLDER,
      this.PROJECT_THUMB_FOLDER,
    ]);
  }

  private mapDirectory(dir: 'Data' | 'Documents' | 'Cache'): Directory {
    if (dir === 'Data') return Directory.Data;
    if (dir === 'Cache') return Directory.Cache;
    return Directory.Documents;
  }

  private debugLog(event: string, payload?: Record<string, unknown>): void {
    if (!this.DEBUG_IO) return;
    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.info(`[ECC:file.service] ${event}${suffix}`);
  }

  private errorDetails(error: unknown): Record<string, unknown> {
    if (error && typeof error === 'object') {
      const e = error as {
        name?: unknown;
        message?: unknown;
        code?: unknown;
        stack?: unknown;
      };
      return {
        name: typeof e.name === 'string' ? e.name : undefined,
        message: typeof e.message === 'string' ? e.message : undefined,
        code:
          typeof e.code === 'string' || typeof e.code === 'number'
            ? e.code
            : undefined,
        stack: typeof e.stack === 'string' ? e.stack : undefined,
      };
    }
    return { message: String(error) };
  }

  private isAlreadyExistsError(error: unknown): boolean {
    const details = this.errorDetails(error);
    const code = String(details['code'] ?? '').toUpperCase();
    const message = String(details['message'] ?? '').toLowerCase();
    return (
      code === 'OS-PLUG-FILE-0010' ||
      message.includes('already exists') ||
      message.includes('cannot be overwritten')
    );
  }
}

