import { Injectable, inject } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileKitService, FileRef } from '@sheldrapps/file-kit';
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
      // For file-kit, we need to read the directory
      // Since file-kit doesn't expose readdir yet, we'll use the old Filesystem API
      // This is acceptable as long as the core file operations use file-kit

      // TODO: Consider adding readdir to file-kit if needed
      // For now, we maintain backward compatibility with Filesystem
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      const list = await Filesystem.readdir({
        directory: Directory.Documents,
        path: this.EPUB_FOLDER,
      });

      const files = (list.files ?? [])
        .map((f: any) => (typeof f === 'string' ? f : f.name))
        .filter((name: string) => name.toLowerCase().endsWith('.epub'));

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
    const epubPath = `${this.EPUB_FOLDER}/${filename}`;
    const thumbPath = this.getThumbPathForEpubFilename(filename);

    // Use file-kit to delete EPUB
    try {
      await this.fileKit.delete({
        dir: 'Documents',
        path: epubPath,
      });
    } catch (error) {
      console.warn('[file.service] Failed to delete EPUB:', error);
    }

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
  }

  async shareCoverByFilename(filename: string) {
    const epubPath = `${this.EPUB_FOLDER}/${filename}`;

    // Get URI via file-kit exists check, then share
    const exists = await this.fileKit.exists({
      dir: 'Documents',
      path: epubPath,
    });

    if (!exists) {
      console.error(`[file.service] Share failed: File not found: ${epubPath}`);
      throw new Error(`File not found: ${epubPath}`);
    }

    // Get the real URI from file-kit
    const uri = await this.fileKit.getUri({
      dir: 'Documents',
      path: epubPath,
    });

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
    const assets = await this.ensureCoverAssets(filename, {
      allowNativeExtract: false,
    });
    return assets.thumbDataUrl;
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

      return thumbBase64;
    } catch {
      return null;
    }
  }
  private async tryReadBase64FromFilesystem(
    path: string,
    dir: 'Data' | 'Documents' | 'Cache' = 'Data',
  ): Promise<string | null> {
    try {
      const bytes = await this.fileKit.readBytes({
        dir,
        path,
      });
      return this.fileKit.toBase64(bytes);
    } catch (error) {
      console.warn(`[file.service] Failed to read ${path} from ${dir}:`, error);
      return null;
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

    // Use file-kit to save EPUB
    const epubRef = await this.fileKit.writeBytes({
      dir: 'Documents',
      path: epubPath,
      bytes: opts.bytes,
      mimeType: 'application/epub+zip',
    });

    const assets = await this.persistCoverAssetsFromFile(
      opts.coverFileForThumb,
      uniqueFilename,
    );

    return {
      path: epubPath,
      uri: epubRef.uri,
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

    await Filesystem.copy({
      from: opts.sourcePath,
      directory: this.mapDirectory(opts.sourceDir),
      to: epubPath,
      toDirectory: Directory.Documents,
    });

    const uri = await this.fileKit.getUri({
      dir: 'Documents',
      path: epubPath,
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

    const exists = await this.fileKit.exists({
      dir: 'Documents',
      path: fromPath,
    });

    if (!exists) {
      throw new Error(`File not found: ${fromPath}`);
    }

    await Filesystem.rename({
      from: fromPath,
      to: toPath,
      directory: Directory.Documents,
      toDirectory: Directory.Documents,
    });

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

    return {
      filename: toFilename,
      path: toPath,
      thumbPath: toThumbPath,
    };
  }

  async existsInDocuments(path: string): Promise<boolean> {
    return this.fileKit.exists({
      dir: 'Documents',
      path,
    });
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
      const exists = await this.existsInDocuments(`${this.EPUB_FOLDER}/${candidate}`);
      if (!exists || (ignore && candidate.toLowerCase() === ignore)) {
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

    const epubPath = `${this.EPUB_FOLDER}/${epubFilename}`;
    try {
      const epubUri = await this.fileKit.getUri({
        dir: 'Documents',
        path: epubPath,
      });

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
}

