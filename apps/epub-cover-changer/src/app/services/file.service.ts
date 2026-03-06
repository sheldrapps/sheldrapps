import { Injectable, inject } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { EpubPublicStore, FileKitService, FileRef } from '@sheldrapps/file-kit';
import { TranslateService } from '@ngx-translate/core';
import { EpubRewriteError, EpubRewriteService } from './epub-rewrite.service';

export type CoverEntry = {
  filename: string;
  epubPath: string;
  thumbPath: string;
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

@Injectable({ providedIn: 'root' })
export class FileService {
  private translate = inject(TranslateService);

  private readonly EPUB_FOLDER = 'EPUBCoverChanger';
  private readonly COVER_FOLDER = 'EPUBCoverChangerCovers';
  private readonly THUMB_FOLDER = 'EPUBCoverChangerThumbs';
  private readonly THUMB_MAX_WIDTH = 320;
  private readonly THUMB_QUALITY = 0.82;
  private readonly COVER_EXTRACT_MAX_BYTES = 30 * 1024 * 1024;
  private readonly APP_NAME = 'EPUB Cover Changer';
  private fileKit = inject(FileKitService);
  private epubRewrite = inject(EpubRewriteService);
  private readonly thumbDataUrlCache = new Map<string, string>();
  private thumbFileNamesCache: Set<string> | null = null;
  private thumbFileNamesCachePromise: Promise<Set<string>> | null = null;
  private readonly DEBUG_IO = false;
  private readonly epubStore = new EpubPublicStore(this.fileKit, {
    epubFolder: this.EPUB_FOLDER,
    publicDocumentsRoot: '/storage/emulated/0/Documents',
    debug: this.DEBUG_IO,
    logPrefix: 'ECC:file-kit',
  });

  /**
   * Validate an EPUB file
   */
  validateEpub(
    file: File,
    maxSizeMB: number = 50,
  ): { valid: boolean; errorKey?: string } {
    return this.fileKit.validateEpub(file, maxSizeMB);
  }

  async validateEpubStructure(file: File): Promise<boolean> {
    if (!this.epubRewrite.isSupported()) return false;
    const tempName = `validate_${Date.now()}_${file.name || 'epub'}`;
    const tempPath = `${this.EPUB_FOLDER}/${tempName}`;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.fileKit.writeBytes({
        dir: 'Cache',
        path: tempPath,
        bytes,
        mimeType: 'application/epub+zip',
      });

      const uri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempPath,
      });
      const inspected = await this.epubRewrite.inspectEpub(uri);
      return inspected.success;
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

  async extractCoverFromEpubFile(file: File): Promise<File | null> {
    if (!this.epubRewrite.isSupported()) return null;
    const tempName = `extract_${Date.now()}_${file.name || 'epub'}`;
    const tempPath = `${this.EPUB_FOLDER}/${tempName}`;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.fileKit.writeBytes({
        dir: 'Cache',
        path: tempPath,
        bytes,
        mimeType: 'application/epub+zip',
      });
      const uri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempPath,
      });
      const extracted = await this.epubRewrite.extractCoverAssetFile({
        epubPath: uri,
        maxBytes: this.COVER_EXTRACT_MAX_BYTES,
        epubName: file.name || 'epub',
      });
      return extracted.file;
    } catch {
      return null;
    } finally {
      try {
        await this.fileKit.delete({ dir: 'Cache', path: tempPath });
      } catch {
        // best effort
      }
    }
  }

  async saveEpub(opts: {
    modelId: string;
    coverFile: File;
    title?: string;
    filename?: string;
  }) {
    const generated = await this.generateEpubBytes(opts);
    return this.saveGeneratedEpub({
      bytes: generated.bytes,
      filename: generated.filename,
      coverFileForThumb: opts.coverFile,
    });
  }

  async shareEpub(opts: { modelId: string; coverFile: File; title?: string }) {
    const generated = await this.generateEpubBytes(opts);
    return this.shareGeneratedEpub({
      bytes: generated.bytes,
      filename: generated.filename,
      title: opts.title,
    });
  }

  getEpubFolder() {
    return this.EPUB_FOLDER;
  }

  getThumbFolder() {
    return this.THUMB_FOLDER;
  }

  getThumbPathForEpubFilename(epubFilename: string) {
    const baseName = epubFilename.replace(/\.epub$/i, '');
    return `${this.THUMB_FOLDER}/${baseName}.jpg`;
  }

  async listCovers(): Promise<CoverEntry[]> {
    try {
      await this.ensurePublicDocumentsEpubFolderReady();
      const files = await this.listEpubsFromPublicDocuments();
      this.debugLog('listCovers', { count: files.length });

      return files.map((filename) => ({
        filename,
        epubPath: `${this.EPUB_FOLDER}/${filename}`,
        thumbPath: this.getThumbPathForEpubFilename(filename),
      }));
    } catch (error) {
      console.warn('[file.service] listCovers failed:', error);
      return [];
    }
  }

  async deleteCoverByFilename(filename: string) {
    await this.ensurePublicDocumentsEpubFolderReady();
    this.debugLog('deleteCoverByFilename:start', { filename });
    const epubPath = `${this.EPUB_FOLDER}/${filename}`;
    const thumbPath = this.getThumbPathForEpubFilename(filename);
    this.clearThumbCache(filename);
    this.markThumbMissing(filename);

    await this.deletePublicEpub(filename);
    await this.deleteDocumentEpubIfExists(epubPath);

    // Use file-kit to delete thumbnail
    try {
      await this.fileKit.delete({
        dir: 'Data',
        path: thumbPath,
      });
    } catch {
      // ignore thumb missing
    }

    const coverBaseName = this.getBaseNameFromEpubFilename(filename);
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
    this.debugLog('deleteCoverByFilename:done', { filename });
  }

  async shareCoverByFilename(filename: string) {
    await this.ensurePublicDocumentsEpubFolderReady();
    const uri = await this.getPublicEpubFileUriOrThrow(filename);
    this.debugLog('shareCoverByFilename', { filename, uri });

    const fileRef: FileRef = {
      uri,
      filename,
      mimeType: 'application/epub+zip',
    };

    await this.fileKit.share(fileRef, {
      title: filename,
      text: 'EPUB cover generated with EPUB Cover Changer',
      dialogTitle: 'Share EPUB',
    });

    return { uri, filename };
  }

  async getOrBuildThumbDataUrlForFilename(
    filename: string,
  ): Promise<string | null> {
    const cached = this.getThumbCache(filename);
    if (cached) {
      return cached;
    }

    const thumbPath = this.getThumbPathForEpubFilename(filename);
    if (await this.hasThumbForFilename(filename)) {
      const thumbBase64 = await this.tryReadBase64FromFilesystem(thumbPath);
      if (thumbBase64) {
        const dataUrl = `data:image/jpeg;base64,${thumbBase64}`;
        this.setThumbCache(filename, dataUrl);
        return dataUrl;
      }
      this.markThumbMissing(filename);
    }

    const cover = await this.readCoverExport(filename);
    if (!cover) {
      return null;
    }

    const builtThumbBase64 = await this.persistThumbFromCoverExport(filename, cover);
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

  async ensureCoverAssets(
    epubFilename: string,
    opts?: { forceThumbRebuild?: boolean; allowNativeExtract?: boolean },
  ): Promise<CoverAssetsResult> {
    let cover = await this.readCoverExport(epubFilename);
    const thumbPath = this.getThumbPathForEpubFilename(epubFilename);
    let thumbBase64 =
      !opts?.forceThumbRebuild
        ? await this.tryReadBase64FromFilesystem(thumbPath)
        : null;

    if (cover && (!thumbBase64 || opts?.forceThumbRebuild)) {
      thumbBase64 = await this.persistThumbFromCoverExport(epubFilename, cover);
    }

    if (!cover && !thumbBase64) {
      thumbBase64 = await this.tryReadBase64FromFilesystem(thumbPath);
    }

    if (!cover && (opts?.allowNativeExtract ?? true)) {
      const extractedCover = await this.extractAndPersistCoverFromEpub(epubFilename);
      if (extractedCover) {
        cover = extractedCover;
        if (!thumbBase64 || opts?.forceThumbRebuild) {
          thumbBase64 = await this.persistThumbFromCoverExport(epubFilename, cover);
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
      this.setThumbCache(epubFilename, thumbDataUrl);
    }

    return {
      coverDataUrl,
      thumbDataUrl,
      previewDataUrl: coverDataUrl ?? thumbDataUrl,
    };
  }

  async hasCoverExportForFilename(epubFilename: string): Promise<boolean> {
    const baseName = this.getBaseNameFromEpubFilename(epubFilename);
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

  private async persistCoverAssetsFromFile(coverFile: File, epubFilename: string) {
    const cover = await this.persistCoverExportFromFile(coverFile, epubFilename);
    const thumbBase64 = await this.arrayBufferToJpegThumbBase64(
      this.toStrictArrayBuffer(cover.bytes),
      cover.filename,
      this.THUMB_MAX_WIDTH,
      this.THUMB_QUALITY,
    );
    const thumbPath = this.getThumbPathForEpubFilename(epubFilename);
    const thumbFilename = thumbPath.split('/').pop() || '';
    const thumbBytes = this.fileKit.fromBase64(thumbBase64);

    await this.fileKit.writeBytes({
      dir: 'Data',
      path: thumbPath,
      bytes: thumbBytes,
      mimeType: 'image/jpeg',
    });
    this.markThumbPresent(epubFilename);
    this.setThumbCache(epubFilename, `data:image/jpeg;base64,${thumbBase64}`);

    return { thumbPath, thumbFilename };
  }

  private async persistThumbFromCoverExport(
    epubFilename: string,
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
      const thumbPath = this.getThumbPathForEpubFilename(epubFilename);

      const thumbBytes = this.fileKit.fromBase64(thumbBase64);

      await this.fileKit.writeBytes({
        dir: 'Data',
        path: thumbPath,
        bytes: thumbBytes,
        mimeType: 'image/jpeg',
      });
      this.markThumbPresent(epubFilename);
      this.setThumbCache(epubFilename, `data:image/jpeg;base64,${thumbBase64}`);

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

  private getThumbFilenameFromEpubFilename(epubFilename: string): string {
    return `${this.getBaseNameFromEpubFilename(epubFilename)}.jpg`.toLowerCase();
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
        this.thumbFileNamesCache = new Set(names.map((name) => name.toLowerCase()));
        return this.thumbFileNamesCache;
      });
    }
    return this.thumbFileNamesCachePromise;
  }

  private async hasThumbForFilename(epubFilename: string): Promise<boolean> {
    const names = await this.getThumbFileNamesCache();
    return names.has(this.getThumbFilenameFromEpubFilename(epubFilename));
  }

  private markThumbPresent(epubFilename: string): void {
    if (!this.thumbFileNamesCache) return;
    this.thumbFileNamesCache.add(this.getThumbFilenameFromEpubFilename(epubFilename));
  }

  private markThumbMissing(epubFilename: string): void {
    if (!this.thumbFileNamesCache) return;
    this.thumbFileNamesCache.delete(this.getThumbFilenameFromEpubFilename(epubFilename));
  }

  private renameThumbPresence(fromFilename: string, toFilename: string): void {
    if (!this.thumbFileNamesCache) return;
    const fromThumb = this.getThumbFilenameFromEpubFilename(fromFilename);
    const toThumb = this.getThumbFilenameFromEpubFilename(toFilename);
    if (this.thumbFileNamesCache.has(fromThumb)) {
      this.thumbFileNamesCache.delete(fromThumb);
      this.thumbFileNamesCache.add(toThumb);
      return;
    }
    this.thumbFileNamesCache.delete(toThumb);
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

  private buildFilename(modelId: string) {
    const now = new Date();
    const safeTs =
      `${now.getFullYear()}` +
      `${String(now.getMonth() + 1).padStart(2, '0')}` +
      `${String(now.getDate()).padStart(2, '0')}_` +
      `${String(now.getHours()).padStart(2, '0')}` +
      `${String(now.getMinutes()).padStart(2, '0')}`;
    return `epub_cover_${modelId}_${safeTs}.epub`;
  }

  private ensureEpubExt(name: string) {
    return /\.epub$/i.test(name) ? name : `${name}.epub`;
  }

  private sanitizeFilename(name: string) {
    const trimmed = (name ?? '').trim() || 'epub_cover';
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

  private getEpubLang(): string {
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

  async generateEpubBytes(opts: {
    modelId: string;
    coverFile: File;
    title?: string;
    filename?: string;
  }): Promise<{ bytes: Uint8Array; filename: string }> {
    if (!this.epubRewrite.isSupported()) {
      throw new Error('Native EPUB generation is only supported on Android.');
    }

    const filename = this.ensureEpubExt(
      this.sanitizeFilename(opts.filename ?? this.buildFilename(opts.modelId)),
    );

    const coverMime = opts.coverFile.type || this.mimeFromFilename(opts.coverFile.name);
    const coverExt = this.coverExtFromMime(coverMime);
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempCoverPath = `${this.EPUB_FOLDER}/tmp_cover_${nonce}.${coverExt}`;
    const tempOutputPath = `${this.EPUB_FOLDER}/tmp_epub_${nonce}.epub`;

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
        mimeType: 'application/epub+zip',
      });

      const coverUri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempCoverPath,
      });
      const outputUri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempOutputPath,
      });

      await this.epubRewrite.createEpubFromCover({
        coverPath: coverUri,
        outputPath: outputUri,
        title: opts.title ?? 'EPUB Cover',
        lang: this.getEpubLang(),
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

  async generateEpubBytesFromSource(opts: {
    sourceEpubFile: File;
    coverFile: File;
    filename?: string;
  }): Promise<{ bytes: Uint8Array; filename: string }> {
    if (!this.epubRewrite.isSupported()) {
      throw new Error('Native EPUB rewrite is only supported on Android.');
    }

    const sourceName = opts.sourceEpubFile?.name || 'epub_cover.epub';
    const filename = this.ensureEpubExt(
      this.sanitizeFilename(opts.filename ?? sourceName),
    );
    const coverMime = opts.coverFile.type || this.mimeFromFilename(opts.coverFile.name);
    const coverExt = this.coverExtFromMime(coverMime);
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempSourcePath = `${this.EPUB_FOLDER}/tmp_source_${nonce}.epub`;
    const tempCoverPath = `${this.EPUB_FOLDER}/tmp_cover_${nonce}.${coverExt}`;
    const tempOutputPath = `${this.EPUB_FOLDER}/tmp_output_${nonce}.epub`;

    try {
      const [sourceBytes, coverBytes] = await Promise.all([
        opts.sourceEpubFile.arrayBuffer(),
        opts.coverFile.arrayBuffer(),
      ]);

      await Promise.all([
        this.fileKit.writeBytes({
          dir: 'Cache',
          path: tempSourcePath,
          bytes: new Uint8Array(sourceBytes),
          mimeType: 'application/epub+zip',
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
          mimeType: 'application/epub+zip',
        }),
      ]);

      const [sourceUri, coverUri, outputUri] = await Promise.all([
        this.fileKit.getUri({ dir: 'Cache', path: tempSourcePath }),
        this.fileKit.getUri({ dir: 'Cache', path: tempCoverPath }),
        this.fileKit.getUri({ dir: 'Cache', path: tempOutputPath }),
      ]);

      const inspected = await this.epubRewrite.inspectEpub(sourceUri);
      if (!inspected.success || !inspected.coverEntryPath) {
        throw new EpubRewriteError(inspected.error ?? 'NO_COVER', {
          message: inspected.message,
          stage: inspected.stage,
        });
      }

      const rewritten = await this.epubRewrite.rewriteCover({
        inputPath: sourceUri,
        outputPath: outputUri,
        coverEntryPath: inspected.coverEntryPath,
        newCoverPath: coverUri,
      });

      if (!rewritten.success) {
        throw new EpubRewriteError(rewritten.error ?? 'REWRITE_FAILED', {
          message: rewritten.message,
          stage: rewritten.stage,
          coverEntryPath: inspected.coverEntryPath,
        });
      }

      const bytes = await this.fileKit.readBytes({
        dir: 'Cache',
        path: tempOutputPath,
      });

      return { bytes, filename };
    } finally {
      await this.cleanupCachePaths([tempSourcePath, tempCoverPath, tempOutputPath]);
    }
  }

  async saveGeneratedEpub(opts: {
    bytes: Uint8Array;
    filename: string;
    coverFileForThumb: File;
  }) {
    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const uniqueFilename = await this.getUniqueDocumentFilename(filename);
    const epubPath = `${this.EPUB_FOLDER}/${uniqueFilename}`;

    await this.writePublicEpub(uniqueFilename, opts.bytes);
    const uri = await this.getPublicEpubFileUriOrThrow(uniqueFilename);
    this.debugLog('saveGeneratedEpub', { filename: uniqueFilename, bytes: opts.bytes.byteLength });

    const assets = await this.persistCoverAssetsFromFile(
      opts.coverFileForThumb,
      uniqueFilename,
    );

    return {
      path: epubPath,
      uri,
      filename: uniqueFilename,
      thumbPath: assets.thumbPath,
      thumbFilename: assets.thumbFilename,
    };
  }

  async saveGeneratedEpubFromPath(opts: {
    sourcePath: string;
    sourceDir: 'Data' | 'Documents' | 'Cache';
    filename: string;
    coverFileForThumb: File;
  }) {
    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const uniqueFilename = await this.getUniqueDocumentFilename(filename);
    const epubPath = `${this.EPUB_FOLDER}/${uniqueFilename}`;

    const bytes = await this.readBytesFromSource(opts.sourcePath, opts.sourceDir);
    await this.writePublicEpub(uniqueFilename, bytes);
    const uri = await this.getPublicEpubFileUriOrThrow(uniqueFilename);
    this.debugLog('saveGeneratedEpubFromPath', {
      sourceDir: opts.sourceDir,
      sourcePath: opts.sourcePath,
      filename: uniqueFilename,
      bytes: bytes.byteLength,
    });

    const assets = await this.persistCoverAssetsFromFile(
      opts.coverFileForThumb,
      uniqueFilename,
    );

    return {
      path: epubPath,
      uri,
      filename: uniqueFilename,
      thumbPath: assets.thumbPath,
      thumbFilename: assets.thumbFilename,
    };
  }

  async reserveNativeDocumentOutput(
    requestedFilename: string,
  ): Promise<NativeDocumentOutputTarget> {
    const filename = this.ensureEpubExt(this.sanitizeFilename(requestedFilename));
    const uniqueFilename = await this.getUniqueDocumentFilename(filename);
    const relativePath = `${this.EPUB_FOLDER}/${uniqueFilename}`;
    await this.ensurePublicDocumentsEpubFolderReady();
    const nativePath = this.publicDocumentsEpubPath(uniqueFilename);

    return {
      filename: uniqueFilename,
      relativePath,
      nativePath,
    };
  }

  async persistCoverAssetsForGeneratedFilename(opts: {
    filename: string;
    coverFileForThumb: File;
  }): Promise<{ thumbPath: string; thumbFilename: string }> {
    await this.ensurePublicDocumentsEpubFolderReady();
    return this.persistCoverAssetsFromFile(opts.coverFileForThumb, opts.filename);
  }

  async saveGeneratedEpubFromExistingDocument(opts: {
    sourceFilename: string;
    filename: string;
    coverFileForThumb: File;
  }) {
    await this.ensurePublicDocumentsEpubFolderReady();
    const sourceFilename = this.ensureEpubExt(this.sanitizeFilename(opts.sourceFilename));
    const sourcePath = `${this.EPUB_FOLDER}/${sourceFilename}`;

    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const uniqueFilename = await this.getUniqueDocumentFilename(filename, '.epub', {
      ignoreFilename: sourceFilename,
    });
    const epubPath = `${this.EPUB_FOLDER}/${uniqueFilename}`;

    if (sourcePath !== epubPath) {
      const bytes = await this.readPublicEpubBytes(sourceFilename);
      await this.writePublicEpub(uniqueFilename, bytes);
    }

    const uri = await this.getPublicEpubFileUriOrThrow(uniqueFilename);
    this.debugLog('saveGeneratedEpubFromExistingDocument', {
      sourceFilename,
      filename: uniqueFilename,
      copied: sourcePath !== epubPath,
    });

    const assets = await this.persistCoverAssetsFromFile(
      opts.coverFileForThumb,
      uniqueFilename,
    );

    return {
      path: epubPath,
      uri,
      filename: uniqueFilename,
      thumbPath: assets.thumbPath,
      thumbFilename: assets.thumbFilename,
    };
  }

  async renameGeneratedEpub(opts: { from: string; to: string }) {
    await this.ensurePublicDocumentsEpubFolderReady();
    const fromFilename = this.ensureEpubExt(this.sanitizeFilename(opts.from));
    const toFilenameRaw = this.ensureEpubExt(this.sanitizeFilename(opts.to));
    const toFilename = await this.getUniqueDocumentFilename(toFilenameRaw, '.epub', {
      ignoreFilename: fromFilename,
    });

    if (fromFilename === toFilename) {
      return {
        filename: toFilename,
        path: `${this.EPUB_FOLDER}/${toFilename}`,
        thumbPath: this.getThumbPathForEpubFilename(toFilename),
      };
    }

    const fromPath = `${this.EPUB_FOLDER}/${fromFilename}`;
    const toPath = `${this.EPUB_FOLDER}/${toFilename}`;

    const exists = await this.existsInPublicDocuments(fromFilename);

    if (!exists) {
      throw new Error(`File not found: ${fromPath}`);
    }

    await Filesystem.rename({
      from: this.publicDocumentsEpubPath(fromFilename),
      to: this.publicDocumentsEpubPath(toFilename),
    });
    await this.deleteDocumentEpubIfExists(fromPath);
    this.debugLog('renameGeneratedEpub', { from: fromFilename, to: toFilename });

    const fromThumbPath = this.getThumbPathForEpubFilename(fromFilename);
    const toThumbPath = this.getThumbPathForEpubFilename(toFilename);
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

    const fromCoverBase = this.getBaseNameFromEpubFilename(fromFilename);
    const toCoverBase = this.getBaseNameFromEpubFilename(toFilename);
    const fromCovers = this.getCoverExportCandidates(fromCoverBase);
    const toCovers = this.getCoverExportCandidates(toCoverBase);

    for (const fromCover of fromCovers) {
      const exists = await this.fileKit.exists({
        dir: 'Data',
        path: fromCover.path,
      });
      if (!exists) continue;

      const toCover = toCovers.find((candidate) => candidate.ext === fromCover.ext);
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
    ext = '.epub',
    opts?: { ignoreFilename?: string },
  ): Promise<string> {
    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const sanitized = this.ensureEpubExt(this.sanitizeFilename(baseName));
    let base = sanitized.replace(new RegExp(`${cleanExt.replace('.', '\\.')}$`, 'i'), '');
    base = base.trim() || 'epub_cover';

    const ignore = opts?.ignoreFilename?.toLowerCase?.() ?? null;
    let candidate = `${base}${cleanExt}`;
    let idx = 1;
    while (true) {
      const exists = await this.existsInPublicDocuments(candidate);
      if ((!exists) || (ignore && candidate.toLowerCase() === ignore)) {
        return candidate;
      }
      candidate = `${base} (${idx})${cleanExt}`;
      idx += 1;
    }
  }

  async deleteGeneratedEpub(filename: string) {
    await this.deleteCoverByFilename(filename);
  }

  async shareGeneratedEpubFromPath(opts: {
    sourcePath: string;
    sourceDir: 'Data' | 'Documents' | 'Cache';
    filename: string;
    title?: string;
  }) {
    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const cachePath = `${this.EPUB_FOLDER}/${filename}`;

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
      mimeType: 'application/epub+zip',
    };

    await this.fileKit.share(fileRef, {
      title: opts.title ?? 'EPUB Cover',
      text: 'EPUB cover generated with EPUB Cover Changer',
      dialogTitle: 'Share EPUB',
    });

    return { uri, filename };
  }

  async shareGeneratedEpub(opts: {
    bytes: Uint8Array;
    filename: string;
    title?: string;
  }) {
    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const cachePath = `${this.EPUB_FOLDER}/${filename}`;

    // Use file-kit to write to cache
    const epubRef = await this.fileKit.writeBytes({
      dir: 'Cache',
      path: cachePath,
      bytes: opts.bytes,
      mimeType: 'application/epub+zip',
    });

    // Use file-kit to share
    await this.fileKit.share(epubRef, {
      title: opts.title ?? 'EPUB Cover',
      text: 'EPUB cover generated with EPUB Cover Changer',
      dialogTitle: 'Share EPUB',
    });

    return { uri: epubRef.uri, filename };
  }

  async getCoverDataUrlForFilename(
    epubFilename: string,
  ): Promise<string | null> {
    const preview = await this.getBestPreviewCoverDataUrl(epubFilename);
    return preview.dataUrl;
  }

  private async persistCoverExportFromFile(coverFile: File, epubFilename: string) {
    const ext = this.coverExtFromMime(coverFile.type || this.mimeFromFilename(coverFile.name));
    const filename = `${this.getBaseNameFromEpubFilename(epubFilename)}.${ext}`;
    const coverPath = `${this.COVER_FOLDER}/${filename}`;
    const mimeType = this.coverMediaTypeFromMime(coverFile.type);
    const bytes = new Uint8Array(await coverFile.arrayBuffer());

    await this.fileKit.writeBytes({
      dir: 'Data',
      path: coverPath,
      bytes,
      mimeType,
    });

    await this.removeOtherCoverExportVariants(epubFilename, ext);

    return { coverPath, filename, mimeType, bytes };
  }

  private async readCoverExport(epubFilename: string): Promise<{
    path: string;
    filename: string;
    base64: string;
    mimeType: string;
  } | null> {
    const baseName = this.getBaseNameFromEpubFilename(epubFilename);
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

  private async extractAndPersistCoverFromEpub(epubFilename: string): Promise<{
    path: string;
    filename: string;
    base64: string;
    mimeType: string;
  } | null> {
    if (!this.epubRewrite.isSupported()) return null;

    try {
      const epubUri = await this.getPublicEpubUri(epubFilename);

      const extracted = await this.epubRewrite.extractCoverAssetFile({
        epubPath: epubUri,
        maxBytes: this.COVER_EXTRACT_MAX_BYTES,
        epubName: epubFilename,
      });

      await this.persistCoverAssetsFromFile(extracted.file, epubFilename);
      return this.readCoverExport(epubFilename);
    } catch (error) {
      console.warn(
        `[file.service] Native cover extraction failed for ${epubFilename}:`,
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
    epubFilename: string,
    keepExt: 'jpg' | 'png' | 'webp',
  ): Promise<void> {
    const baseName = this.getBaseNameFromEpubFilename(epubFilename);
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

  private getBaseNameFromEpubFilename(epubFilename: string): string {
    return epubFilename.replace(/\.epub$/i, '');
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
    } catch {
      return [];
    }
  }

  private publicDocumentsEpubPath(filename: string): string {
    return this.epubStore.pathFor(filename);
  }

  private async listEpubsFromPublicDocuments(): Promise<string[]> {
    return this.epubStore.listEpubs();
  }

  private async writePublicEpub(filename: string, bytes: Uint8Array): Promise<void> {
    await this.epubStore.writeEpub(filename, bytes);
  }

  private async deletePublicEpub(filename: string): Promise<void> {
    await this.epubStore.deleteEpub(filename);
  }

  private async deleteDocumentEpubIfExists(relativePath: string): Promise<void> {
    await this.epubStore.deleteDocumentEpubIfExists(relativePath);
  }

  private async existsInPublicDocuments(filename: string): Promise<boolean> {
    return this.epubStore.exists(filename);
  }

  private async readPublicEpubBytes(filename: string): Promise<Uint8Array> {
    return this.epubStore.readBytes(filename);
  }

  private async getPublicEpubFileUriOrThrow(filename: string): Promise<string> {
    const uri = await this.epubStore.getUriOrThrow(filename);
    this.debugLog('getPublicEpubFileUriOrThrow', { filename, uri });
    return uri;
  }

  private async getPublicEpubUri(filename: string): Promise<string> {
    return this.getPublicEpubFileUriOrThrow(filename);
  }

  private async ensurePublicDocumentsEpubFolderReady(): Promise<void> {
    await this.epubStore.ensureReady();
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

}

