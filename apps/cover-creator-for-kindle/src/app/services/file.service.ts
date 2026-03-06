import { Injectable, inject } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { EpubPublicStore, FileKitService, FileRef } from '@sheldrapps/file-kit';
import { TranslateService } from '@ngx-translate/core';
import { EpubRewriteService } from './epub-rewrite.service';

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
  private readonly EPUB_FOLDER = 'CoverCreator';
  private readonly COVER_FOLDER = 'CoverCreatorCovers';
  private readonly THUMB_FOLDER = 'CoverCreatorThumbs';
  private readonly THUMB_MAX_WIDTH = 320;
  private readonly THUMB_QUALITY = 0.82;
  private readonly LEGACY_COVER_MAX_BYTES = 30 * 1024 * 1024;
  private readonly APP_NAME = 'Cover creator for kindle';

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
    logPrefix: 'CCFK:file-kit',
  });

  constructor(private translate: TranslateService) {}

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
    const baseName = this.getBaseNameFromEpubFilename(epubFilename);
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
    } catch {
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

    try {
      await this.fileKit.delete({ dir: 'Data', path: thumbPath });
    } catch {
      // ignore missing thumb
    }

    const coverBaseName = this.getBaseNameFromEpubFilename(filename);
    const coverCandidates = this.getCoverExportCandidates(coverBaseName);
    for (const candidate of coverCandidates) {
      try {
        await this.fileKit.delete({ dir: 'Data', path: candidate.path });
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
      text: 'EPUB cover generated with Cover creator for kindle',
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
      return { dataUrl: assets.coverDataUrl, source: 'cover-export' };
    }

    if (assets.thumbDataUrl) {
      return { dataUrl: assets.thumbDataUrl, source: 'thumb-fallback' };
    }

    return { dataUrl: null, source: 'unavailable' };
  }

  async ensureCoverAssets(
    epubFilename: string,
    opts?: { forceThumbRebuild?: boolean; allowNativeExtract?: boolean },
  ): Promise<CoverAssetsResult> {
    let cover = await this.readCoverExport(epubFilename);
    const thumbPath = this.getThumbPathForEpubFilename(epubFilename);
    let thumbBase64 = !opts?.forceThumbRebuild
      ? await this.tryReadBase64FromFilesystem(thumbPath)
      : null;

    if (cover && (!thumbBase64 || opts?.forceThumbRebuild)) {
      thumbBase64 = await this.persistThumbFromCoverExport(epubFilename, cover);
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

      // Ensure we can request a stable file:// URI for output.
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
        title: opts.title ?? 'Kindle Cover',
        lang: this.getEpubLang(),
        appName: this.APP_NAME,
      });

      const bytes = await this.fileKit.readBytes({
        dir: 'Cache',
        path: tempOutputPath,
      });

      return { bytes, filename };
    } finally {
      try {
        await this.fileKit.delete({ dir: 'Cache', path: tempCoverPath });
      } catch {
        // best effort
      }
      try {
        await this.fileKit.delete({ dir: 'Cache', path: tempOutputPath });
      } catch {
        // best effort
      }
    }
  }

  async saveGeneratedEpub(opts: {
    bytes: Uint8Array;
    filename: string;
    coverFileForThumb: File;
  }) {
    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const epubPath = `${this.EPUB_FOLDER}/${filename}`;

    await this.writePublicEpub(filename, opts.bytes);
    const uri = await this.getPublicEpubFileUriOrThrow(filename);
    this.debugLog('saveGeneratedEpub', { filename, bytes: opts.bytes.byteLength });

    const assets = await this.persistCoverAssetsFromFile(opts.coverFileForThumb, filename);

    return {
      path: epubPath,
      uri,
      filename,
      thumbPath: assets.thumbPath,
      thumbFilename: assets.thumbFilename,
    };
  }

  async renameGeneratedEpub(opts: { from: string; to: string }) {
    await this.ensurePublicDocumentsEpubFolderReady();
    const fromFilename = this.ensureEpubExt(this.sanitizeFilename(opts.from));
    const toFilename = this.ensureEpubExt(this.sanitizeFilename(opts.to));

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
      const thumbBytes = await this.fileKit.readBytes({
        dir: 'Data',
        path: fromThumbPath,
      });
      await this.fileKit.writeBytes({
        dir: 'Data',
        path: toThumbPath,
        bytes: thumbBytes,
        mimeType: 'image/jpeg',
      });
      try {
        await this.fileKit.delete({ dir: 'Data', path: fromThumbPath });
      } catch {
        // ignore
      }
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

      const coverBytes = await this.fileKit.readBytes({
        dir: 'Data',
        path: fromCover.path,
      });
      await this.fileKit.writeBytes({
        dir: 'Data',
        path: toCover.path,
        bytes: coverBytes,
        mimeType: toCover.mimeType,
      });
      try {
        await this.fileKit.delete({ dir: 'Data', path: fromCover.path });
      } catch {
        // ignore
      }
    }
    this.renameThumbCache(fromFilename, toFilename);
    this.renameThumbPresence(fromFilename, toFilename);

    return {
      filename: toFilename,
      path: toPath,
      thumbPath: toThumbPath,
    };
  }

  async deleteGeneratedEpub(filename: string) {
    await this.deleteCoverByFilename(filename);
  }

  async shareGeneratedEpub(opts: {
    bytes: Uint8Array;
    filename: string;
    title?: string;
  }) {
    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const cachePath = `${this.EPUB_FOLDER}/${filename}`;

    const epubRef = await this.fileKit.writeBytes({
      dir: 'Cache',
      path: cachePath,
      bytes: opts.bytes,
      mimeType: 'application/epub+zip',
    });

    await this.fileKit.share(epubRef, {
      title: opts.title ?? 'Kindle Cover',
      text: 'EPUB cover generated with Cover creator for kindle',
      dialogTitle: 'Share EPUB',
    });

    return { uri: epubRef.uri, filename };
  }

  async getCoverDataUrlForFilename(epubFilename: string): Promise<string | null> {
    const preview = await this.getBestPreviewCoverDataUrl(epubFilename, {
      allowNativeExtract: true,
    });
    return preview.dataUrl;
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

  private async persistCoverExportFromFile(coverFile: File, epubFilename: string) {
    const inferredMime = coverFile.type || this.mimeFromFilename(coverFile.name);
    const ext = this.coverExtFromMime(inferredMime);
    const filename = `${this.getBaseNameFromEpubFilename(epubFilename)}.${ext}`;
    const coverPath = `${this.COVER_FOLDER}/${filename}`;
    const mimeType = this.coverMediaTypeFromMime(inferredMime);
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
        maxBytes: this.LEGACY_COVER_MAX_BYTES,
        epubName: epubFilename,
      });

      await this.persistCoverAssetsFromFile(extracted.file, epubFilename);
      return this.readCoverExport(epubFilename);
    } catch {
      return null;
    }
  }

  private async persistThumbFromCoverExport(
    epubFilename: string,
    cover: { base64: string; mimeType: string; filename: string },
  ): Promise<string | null> {
    try {
      const coverBytes = this.base64ToUint8(cover.base64);
      const thumbBase64 = await this.arrayBufferToJpegThumbBase64(
        this.toStrictArrayBuffer(coverBytes),
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
        const bytes = await this.fileKit.readBytes({ dir, path });
        return this.fileKit.toBase64(bytes);
      } catch {
        return null;
      }
    }
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

  private base64ToUint8(base64: string): Uint8Array {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
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
    const objectUrl = URL.createObjectURL(blob);

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
    return `kindle_cover_${modelId}_${safeTs}.epub`;
  }

  private ensureEpubExt(name: string) {
    return /\.epub$/i.test(name) ? name : `${name}.epub`;
  }

  private sanitizeFilename(name: string) {
    const trimmed = (name ?? '').trim() || 'kindle_cover';
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

  private mapDirectory(dir: 'Data' | 'Documents' | 'Cache'): Directory {
    if (dir === 'Data') return Directory.Data;
    if (dir === 'Cache') return Directory.Cache;
    return Directory.Documents;
  }

  private debugLog(event: string, payload?: Record<string, unknown>): void {
    if (!this.DEBUG_IO) return;
    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.info(`[CCFK:file.service] ${event}${suffix}`);
  }
}
