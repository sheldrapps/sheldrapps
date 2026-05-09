import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import JSZip from 'jszip';
import { BestCandidateHint, BestCandidateImage } from '@sheldrapps/best-candidate-kit';

type ExtractCandidateImagesParams = {
  epubFile?: File;
  epubNativePath?: string;
  epubName?: string;
  maxImages?: number;
};

export type CandidateDiscoveryRejection = {
  path: string;
  reason: string;
};

export type CandidateDiscoveryDiagnostics = {
  manifestImageCount: number;
  zipImageCount: number;
  mergedImageCount: number;
  candidatesAfterFilters: number;
  rejectedImages: CandidateDiscoveryRejection[];
};

export type CandidateDiscoveryResult = {
  images: BestCandidateImage[];
  diagnostics: CandidateDiscoveryDiagnostics;
};

export type StrictCoverResolution = {
  file: File;
  sourcePath: string;
};

type ManifestImageEntry = {
  id: string;
  href: string;
  mediaType: string;
  normalizedPath: string;
  index: number;
  hints: BestCandidateHint[];
};

type ZipImageEntry = {
  normalizedPath: string;
  index: number;
};

@Injectable({ providedIn: 'root' })
export class EpubCandidateImageService {
  private readonly COVER_WORDS = ['cover', 'front', 'title', 'portada', 'cubierta'];
  private readonly PENALTY_WORDS = ['logo', 'icon', 'avatar', 'separator', 'ornament', 'bullet'];

  async extractCandidateImages(
    params: ExtractCandidateImagesParams,
  ): Promise<BestCandidateImage[]> {
    const discovered = await this.discoverInternalImages(params);
    return discovered.images;
  }

  async discoverInternalImages(
    params: ExtractCandidateImagesParams,
  ): Promise<CandidateDiscoveryResult> {
    const maxImages = Math.max(1, params.maxImages ?? Number.MAX_SAFE_INTEGER);
    const bytes = await this.readEpubBytes(params);
    if (!bytes) {
      return {
        images: [],
        diagnostics: this.emptyDiagnostics(),
      };
    }

    const zip = await JSZip.loadAsync(bytes);
    const opfPath = await this.resolveOpfPath(zip);
    const zipEntries = this.collectZipImages(zip);
    const zipImageCount = zipEntries.length;
    const manifestEntries = await this.loadManifestImages(zip, opfPath);
    const mergedEntries = this.mergeImageEntries(manifestEntries, zipEntries).slice(
      0,
      maxImages,
    );
    const candidates: BestCandidateImage[] = [];
    const rejectedImages: CandidateDiscoveryRejection[] = [];

    for (const entry of mergedEntries) {
      const path = entry.normalizedPath;
      if (!path) {
        rejectedImages.push({
          path: '',
          reason: 'empty-path',
        });
        continue;
      }

      const zipImage = zip.file(path);
      if (!zipImage) {
        rejectedImages.push({
          path,
          reason: 'missing-zip-entry',
        });
        continue;
      }

      const imageBytes = await zipImage.async('uint8array');
      const mimeType = this.normalizeMimeType(
        entry.mediaType ?? '',
        path,
      );
      if (!this.isSupportedImageMime(mimeType)) {
        rejectedImages.push({
          path,
          reason: 'unsupported-mime',
        });
        continue;
      }

      const fileName = this.fileNameFromPath(path);
      const file = new File([this.toStrictArrayBuffer(imageBytes)], fileName, {
        type: mimeType,
      });
      const dims = await this.readImageDimensions(file);
      if (!dims) {
        rejectedImages.push({
          path,
          reason: 'unreadable-image',
        });
        continue;
      }

      const hints = this.mergeHints(
        entry.hints,
        this.mergeHints(this.inferHintsFromFileName(fileName, entry.index), this.inferHintsFromGeometry(dims)),
      );
      const id = `${path}#${entry.index}`;
      const src = URL.createObjectURL(file);

      candidates.push({
        id,
        src,
        sourcePath: path,
        fileName,
        width: dims.width,
        height: dims.height,
        mimeType,
        sizeBytes: imageBytes.byteLength,
        index: entry.index,
        hints,
        metadata: { file },
      });
    }

    const firstLarge = candidates.find((candidate) => candidate.width * candidate.height >= 160000);
    if (firstLarge) {
      firstLarge.hints = this.mergeHints(firstLarge.hints, ['first-large-image']);
    }

    return {
      images: candidates,
      diagnostics: {
        manifestImageCount: manifestEntries.length,
        zipImageCount,
        mergedImageCount: mergedEntries.length,
        candidatesAfterFilters: candidates.length,
        rejectedImages,
      },
    };
  }

  async resolveStrictCover(
    params: ExtractCandidateImagesParams,
  ): Promise<StrictCoverResolution | null> {
    const bytes = await this.readEpubBytes(params);
    if (!bytes) return null;

    const zip = await JSZip.loadAsync(bytes);
    const opfPath = await this.resolveOpfPath(zip);
    if (!opfPath) return null;
    const opfEntry = zip.file(opfPath);
    if (!opfEntry) return null;
    const opfText = await opfEntry.async('text');
    const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml');
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
    const explicitCoverIds = this.collectExplicitCoverIds(opfDoc);
    const manifestEntries = this.collectManifestImages(opfDoc, opfDir, 500, explicitCoverIds);

    const strictEntry = this.pickStrictCoverEntry(manifestEntries);
    if (!strictEntry) return null;

    const zipImage = zip.file(strictEntry.normalizedPath);
    if (!zipImage) return null;
    const imageBytes = await zipImage.async('uint8array');
    const mimeType = this.normalizeMimeType(strictEntry.mediaType, strictEntry.normalizedPath);
    if (!mimeType.startsWith('image/')) return null;
    if (mimeType === 'image/svg+xml') return null;

    const fileName = this.fileNameFromPath(strictEntry.normalizedPath);
    const file = new File([this.toStrictArrayBuffer(imageBytes)], fileName, {
      type: mimeType,
    });

    return {
      file,
      sourcePath: strictEntry.normalizedPath,
    };
  }

  private async readEpubBytes(
    params: ExtractCandidateImagesParams,
  ): Promise<Uint8Array | null> {
    if (params.epubFile) {
      return new Uint8Array(await params.epubFile.arrayBuffer());
    }
    if (!params.epubNativePath) return null;

    const fileUri = params.epubNativePath.startsWith('file://')
      ? params.epubNativePath
      : `file://${params.epubNativePath}`;
    const url = Capacitor.convertFileSrc(fileUri);
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  private async resolveOpfPath(zip: JSZip): Promise<string | null> {
    const container = zip.file('META-INF/container.xml');
    if (container) {
      const xml = await container.async('text');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const rootfile = doc.querySelector('rootfile');
      const fullPath = rootfile?.getAttribute('full-path');
      if (fullPath && zip.file(fullPath)) {
        return fullPath;
      }
    }

    const opfFile = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith('.opf'));
    return opfFile ?? null;
  }

  private collectZipImages(zip: JSZip): ZipImageEntry[] {
    const files = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry, index) => ({ name: entry.name, index }));

    return files
      .filter(({ name }) => this.isSupportedImageExtension(name))
      .map(({ name, index }) => ({
        normalizedPath: this.normalizePath(name),
        index,
      }));
  }

  private async loadManifestImages(
    zip: JSZip,
    opfPath: string | null,
  ): Promise<ManifestImageEntry[]> {
    if (!opfPath) return [];
    const opfEntry = zip.file(opfPath);
    if (!opfEntry) return [];
    const opfText = await opfEntry.async('text');
    const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml');
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
    const explicitCoverIds = this.collectExplicitCoverIds(opfDoc);
    return this.collectManifestImages(
      opfDoc,
      opfDir,
      Number.MAX_SAFE_INTEGER,
      explicitCoverIds,
    );
  }

  private mergeImageEntries(
    manifestEntries: ManifestImageEntry[],
    zipEntries: ZipImageEntry[],
  ): Array<{
    normalizedPath: string;
    index: number;
    mediaType?: string;
    hints: BestCandidateHint[];
  }> {
    const merged = new Map<
      string,
      {
        normalizedPath: string;
        index: number;
        mediaType?: string;
        hints: BestCandidateHint[];
      }
    >();

    for (const zipEntry of zipEntries) {
      merged.set(zipEntry.normalizedPath, {
        normalizedPath: zipEntry.normalizedPath,
        index: zipEntry.index,
        mediaType: undefined,
        hints: this.inferHintsFromFileName(
          this.fileNameFromPath(zipEntry.normalizedPath),
          zipEntry.index,
        ),
      });
    }

    for (const manifestEntry of manifestEntries) {
      const existing = merged.get(manifestEntry.normalizedPath);
      if (!existing) {
        merged.set(manifestEntry.normalizedPath, {
          normalizedPath: manifestEntry.normalizedPath,
          index: manifestEntry.index,
          mediaType: manifestEntry.mediaType,
          hints: manifestEntry.hints,
        });
        continue;
      }

      existing.index = Math.min(existing.index, manifestEntry.index);
      existing.mediaType = manifestEntry.mediaType || existing.mediaType;
      existing.hints = this.mergeHints(existing.hints, manifestEntry.hints);
    }

    return Array.from(merged.values()).sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return a.normalizedPath.localeCompare(b.normalizedPath);
    });
  }

  private collectManifestImages(
    opfDoc: Document,
    opfDir: string,
    maxImages: number,
    explicitCoverIds: Set<string>,
  ): ManifestImageEntry[] {
    const manifest = opfDoc.querySelector('manifest');
    if (!manifest) return [];

    const items = Array.from(manifest.querySelectorAll('item'));
    const entries: ManifestImageEntry[] = [];

    for (const item of items) {
      if (entries.length >= maxImages) break;
      const href = item.getAttribute('href') || '';
      const id = item.getAttribute('id') || '';
      const mediaType = item.getAttribute('media-type') || '';
      if (!href || !mediaType.toLowerCase().startsWith('image/')) {
        continue;
      }

      const normalizedPath = this.resolveRelativePath(opfDir, href);
      const normalizedName = normalizedPath.toLowerCase();
      const idLower = id.toLowerCase();
      const fileName = this.fileNameFromPath(normalizedPath).toLowerCase();
      const hints: BestCandidateHint[] = [];

      const itemProperties = (item.getAttribute('properties') || '')
        .split(/\s+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      const hasCoverProperty = itemProperties.includes('cover-image');
      const hasExplicitCoverId = explicitCoverIds.has(idLower);
      const hasConventionalCoverId = idLower === 'cover' || idLower === 'cover-image';

      if (hasCoverProperty || hasExplicitCoverId || hasConventionalCoverId) {
        hints.push('metadata-cover');
      }
      if (this.matchesKeyword(fileName, 'front')) {
        hints.push('filename-front');
      }
      if (this.matchesAnyKeyword(fileName, this.COVER_WORDS)) {
        hints.push('filename-cover');
      }
      if (entries.length <= 3) {
        hints.push('near-book-start');
      }
      if (this.matchesAnyKeyword(fileName, this.PENALTY_WORDS)) {
        hints.push('small-icon-risk');
      }

      entries.push({
        id,
        href,
        mediaType,
        normalizedPath,
        index: entries.length,
        hints: this.mergeHints([], hints),
      });
    }

    return entries;
  }

  private inferHintsFromGeometry(dims: {
    width: number;
    height: number;
  }): BestCandidateHint[] {
    const hints: BestCandidateHint[] = [];
    const ratio = dims.width / dims.height;
    const pixels = dims.width * dims.height;

    if (ratio >= 0.5 && ratio <= 0.85) {
      hints.push('cover-ratio');
    }
    if (pixels >= 500000 || dims.width >= 900 || dims.height >= 1200) {
      hints.push('large-resolution');
    }
    if (dims.width < 180 || dims.height < 180) {
      hints.push('small-icon-risk');
    }
    if (ratio > 2.5 || ratio < 0.32) {
      hints.push('decorative-risk');
    }

    return hints;
  }

  private resolveRelativePath(baseDir: string, href: string): string {
    const joined = baseDir ? `${baseDir}/${href}` : href;
    const normalized = this.normalizePath(joined);
    const parts = normalized.split('/');
    const stack: string[] = [];

    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        stack.pop();
        continue;
      }
      stack.push(part);
    }

    return stack.join('/');
  }

  private fileNameFromPath(path: string): string {
    const normalized = this.normalizePath(path);
    return normalized.split('/').pop() || normalized;
  }

  private async readImageDimensions(
    file: File,
  ): Promise<{ width: number; height: number } | null> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const dims = await new Promise<{ width: number; height: number } | null>(
        (resolve) => {
          const image = new Image();
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => resolve(null);
          image.src = objectUrl;
        },
      );
      return dims;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private normalizeMimeType(mediaType: string, path: string): string {
    const normalized = mediaType.toLowerCase();
    if (normalized) return normalized;
    const ext = path.split('.').pop()?.toLowerCase() || '';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'bmp') return 'image/bmp';
    if (ext === 'avif') return 'image/avif';
    if (ext === 'heic') return 'image/heic';
    if (ext === 'heif') return 'image/heif';
    if (ext === 'svg') return 'image/svg+xml';
    return 'image/jpeg';
  }

  private mergeHints(
    base: BestCandidateHint[] | undefined,
    incoming: BestCandidateHint[],
  ): BestCandidateHint[] {
    return Array.from(new Set([...(base ?? []), ...incoming]));
  }

  private collectExplicitCoverIds(opfDoc: Document): Set<string> {
    const ids = new Set<string>();
    const metadata = opfDoc.querySelector('metadata');
    if (!metadata) return ids;

    const metas = Array.from(metadata.querySelectorAll('meta'));
    for (const meta of metas) {
      const metaName = (meta.getAttribute('name') || '').trim().toLowerCase();
      if (metaName !== 'cover') continue;
      const content = (meta.getAttribute('content') || '').trim().toLowerCase();
      if (content) {
        ids.add(content);
      }
    }

    return ids;
  }

  private matchesAnyKeyword(value: string, words: string[]): boolean {
    return words.some((word) => this.matchesKeyword(value, word));
  }

  private matchesKeyword(value: string, keyword: string): boolean {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    return pattern.test(value);
  }

  private inferHintsFromFileName(
    fileName: string,
    index: number,
  ): BestCandidateHint[] {
    const normalized = fileName.toLowerCase();
    const hints: BestCandidateHint[] = [];
    if (this.matchesKeyword(normalized, 'front')) {
      hints.push('filename-front');
    }
    if (this.matchesAnyKeyword(normalized, this.COVER_WORDS)) {
      hints.push('filename-cover');
    }
    if (index <= 3) {
      hints.push('near-book-start');
    }
    if (this.matchesAnyKeyword(normalized, this.PENALTY_WORDS)) {
      hints.push('small-icon-risk');
    }
    return hints;
  }

  private normalizePath(path: string): string {
    return (path || '').replace(/\\/g, '/').trim();
  }

  private isSupportedImageExtension(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif', 'svg'].includes(ext);
  }

  private isSupportedImageMime(mimeType: string): boolean {
    return [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/avif',
      'image/heic',
      'image/heif',
    ].includes(mimeType.toLowerCase());
  }

  private pickStrictCoverEntry(
    entries: ManifestImageEntry[],
  ): ManifestImageEntry | null {
    const metadataMatch = entries.find((entry) =>
      entry.hints.includes('metadata-cover'),
    );
    if (metadataMatch) return metadataMatch;

    return null;
  }

  private toStrictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
  }

  private emptyDiagnostics(): CandidateDiscoveryDiagnostics {
    return {
      manifestImageCount: 0,
      zipImageCount: 0,
      mergedImageCount: 0,
      candidatesAfterFilters: 0,
      rejectedImages: [],
    };
  }
}
