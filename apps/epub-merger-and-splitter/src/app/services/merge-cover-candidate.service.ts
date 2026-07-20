import { Injectable } from '@angular/core';
import {
  type BestCandidateHint,
  type BestCandidateImage,
} from '@sheldrapps/best-candidate-kit';
import JSZip from 'jszip';

export type MergeCoverCandidateSource = {
  epubId: string;
  epubName: string;
  epubFile: File;
  order: number;
};

type ImageEntry = {
  path: string;
  mediaType: string;
  index: number;
  hints: BestCandidateHint[];
};

@Injectable({ providedIn: 'root' })
export class MergeCoverCandidateService {
  private readonly coverWords = ['cover', 'front', 'title', 'portada', 'cubierta'];
  private readonly penaltyWords = [
    'logo',
    'icon',
    'avatar',
    'separator',
    'ornament',
    'bullet',
  ];

  async collectCandidates(
    sources: readonly MergeCoverCandidateSource[],
  ): Promise<BestCandidateImage[]> {
    const candidates: BestCandidateImage[] = [];

    for (const source of sources) {
      candidates.push(...(await this.collectFromSource(source)));
    }

    const firstLarge = candidates.find(
      (candidate) => candidate.width * candidate.height >= 160000,
    );
    if (firstLarge) {
      firstLarge.hints = this.mergeHints(firstLarge.hints, [
        'first-large-image',
      ]);
    }

    return candidates;
  }

  private async collectFromSource(
    source: MergeCoverCandidateSource,
  ): Promise<BestCandidateImage[]> {
    const zip = await JSZip.loadAsync(await source.epubFile.arrayBuffer());
    const opfPath = await this.resolveOpfPath(zip);
    const manifestEntries = opfPath
      ? await this.collectManifestImages(zip, opfPath)
      : [];
    const zipEntries = this.collectZipImages(zip);
    const entries = this.mergeEntries(manifestEntries, zipEntries);
    const candidates: BestCandidateImage[] = [];

    for (const entry of entries) {
      const zipImage = zip.file(entry.path);
      if (!zipImage) {
        continue;
      }

      const mimeType = this.normalizeMimeType(entry.mediaType, entry.path);
      if (!this.isSupportedImageMime(mimeType)) {
        continue;
      }

      const bytes = await zipImage.async('uint8array');
      const fileName = this.fileNameFromPath(entry.path);
      const file = new File([this.toStrictArrayBuffer(bytes)], fileName, {
        type: mimeType,
      });
      const dims = await this.readImageDimensions(file);
      if (!dims) {
        continue;
      }

      candidates.push({
        id: `${source.epubId}:${entry.path}:${entry.index}`,
        src: URL.createObjectURL(file),
        sourcePath: entry.path,
        fileName: `${source.order}. ${fileName}`,
        width: dims.width,
        height: dims.height,
        mimeType,
        sizeBytes: bytes.byteLength,
        index: source.order * 1000 + entry.index,
        hints: this.mergeHints(
          entry.hints,
          this.inferHintsFromGeometry(dims),
        ),
        metadata: {
          epubId: source.epubId,
          epubName: source.epubName,
          file,
        },
      });
    }

    return candidates;
  }

  private async resolveOpfPath(zip: JSZip): Promise<string | null> {
    const container = zip.file('META-INF/container.xml');
    if (container) {
      const xml = await container.async('text');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const fullPath = doc.querySelector('rootfile')?.getAttribute('full-path');
      if (fullPath && zip.file(fullPath)) {
        return fullPath;
      }
    }

    return (
      Object.keys(zip.files).find((name) =>
        name.toLowerCase().endsWith('.opf'),
      ) ?? null
    );
  }

  private async collectManifestImages(
    zip: JSZip,
    opfPath: string,
  ): Promise<ImageEntry[]> {
    const opfEntry = zip.file(opfPath);
    if (!opfEntry) {
      return [];
    }

    const opfText = await opfEntry.async('text');
    const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml');
    const opfDir = opfPath.includes('/')
      ? opfPath.slice(0, opfPath.lastIndexOf('/'))
      : '';
    const explicitCoverIds = this.collectExplicitCoverIds(opfDoc);
    const items = Array.from(opfDoc.querySelectorAll('manifest item'));

    return items
      .map((item, index): ImageEntry | null => {
        const href = item.getAttribute('href') || '';
        const id = item.getAttribute('id') || '';
        const mediaType = item.getAttribute('media-type') || '';
        if (!href || !mediaType.toLowerCase().startsWith('image/')) {
          return null;
        }

        const path = this.resolveRelativePath(opfDir, href);
        const fileName = this.fileNameFromPath(path).toLowerCase();
        const itemProperties = (item.getAttribute('properties') || '')
          .split(/\s+/)
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);
        const hints = this.inferHintsFromFileName(fileName, index);
        const idLower = id.toLowerCase();

        if (
          itemProperties.includes('cover-image') ||
          explicitCoverIds.has(idLower) ||
          idLower === 'cover' ||
          idLower === 'cover-image'
        ) {
          hints.push('metadata-cover');
        }

        return {
          path,
          mediaType,
          index,
          hints: this.mergeHints([], hints),
        };
      })
      .filter((entry): entry is ImageEntry => !!entry);
  }

  private collectZipImages(zip: JSZip): ImageEntry[] {
    return Object.values(zip.files)
      .filter((entry) => !entry.dir && this.isSupportedImageExtension(entry.name))
      .map((entry, index) => {
        const path = this.normalizePath(entry.name);
        return {
          path,
          mediaType: this.normalizeMimeType('', path),
          index,
          hints: this.inferHintsFromFileName(this.fileNameFromPath(path), index),
        };
      });
  }

  private mergeEntries(
    manifestEntries: readonly ImageEntry[],
    zipEntries: readonly ImageEntry[],
  ): ImageEntry[] {
    const entries = new Map<string, ImageEntry>();

    for (const entry of zipEntries) {
      entries.set(entry.path, entry);
    }

    for (const entry of manifestEntries) {
      const existing = entries.get(entry.path);
      if (!existing) {
        entries.set(entry.path, entry);
        continue;
      }

      entries.set(entry.path, {
        ...existing,
        mediaType: entry.mediaType || existing.mediaType,
        index: Math.min(existing.index, entry.index),
        hints: this.mergeHints(existing.hints, entry.hints),
      });
    }

    return Array.from(entries.values()).sort((a, b) => {
      if (a.index !== b.index) {
        return a.index - b.index;
      }
      return a.path.localeCompare(b.path);
    });
  }

  private async readImageDimensions(
    file: File,
  ): Promise<{ width: number; height: number } | null> {
    const objectUrl = URL.createObjectURL(file);

    try {
      return await new Promise((resolve) => {
        const image = new Image();
        image.onload = () =>
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        image.onerror = () => resolve(null);
        image.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private collectExplicitCoverIds(opfDoc: Document): Set<string> {
    const ids = new Set<string>();

    for (const meta of Array.from(opfDoc.querySelectorAll('metadata meta'))) {
      if ((meta.getAttribute('name') || '').trim().toLowerCase() !== 'cover') {
        continue;
      }

      const content = (meta.getAttribute('content') || '').trim().toLowerCase();
      if (content) {
        ids.add(content);
      }
    }

    return ids;
  }

  private inferHintsFromGeometry(dims: {
    width: number;
    height: number;
  }): BestCandidateHint[] {
    const ratio = dims.width / dims.height;
    const pixels = dims.width * dims.height;
    const hints: BestCandidateHint[] = [];

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

  private inferHintsFromFileName(
    fileName: string,
    index: number,
  ): BestCandidateHint[] {
    const normalized = fileName.toLowerCase();
    const hints: BestCandidateHint[] = [];

    if (this.matchesKeyword(normalized, 'front')) {
      hints.push('filename-front');
    }
    if (this.matchesAnyKeyword(normalized, this.coverWords)) {
      hints.push('filename-cover');
    }
    if (index <= 3) {
      hints.push('near-book-start');
    }
    if (this.matchesAnyKeyword(normalized, this.penaltyWords)) {
      hints.push('small-icon-risk');
    }

    return hints;
  }

  private resolveRelativePath(baseDir: string, href: string): string {
    const joined = baseDir ? `${baseDir}/${href}` : href;
    const stack: string[] = [];

    for (const part of this.normalizePath(joined).split('/')) {
      if (!part || part === '.') {
        continue;
      }
      if (part === '..') {
        stack.pop();
        continue;
      }
      stack.push(part);
    }

    return stack.join('/');
  }

  private normalizeMimeType(mediaType: string, path: string): string {
    const normalized = mediaType.toLowerCase();
    if (normalized) {
      return normalized;
    }

    const ext = path.split('.').pop()?.toLowerCase() || '';
    if (ext === 'png') {
      return 'image/png';
    }
    if (ext === 'webp') {
      return 'image/webp';
    }
    if (ext === 'gif') {
      return 'image/gif';
    }
    return 'image/jpeg';
  }

  private isSupportedImageExtension(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
  }

  private isSupportedImageMime(mimeType: string): boolean {
    return ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
      mimeType.toLowerCase(),
    );
  }

  private matchesAnyKeyword(value: string, words: readonly string[]): boolean {
    return words.some((word) => this.matchesKeyword(value, word));
  }

  private matchesKeyword(value: string, keyword: string): boolean {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(value);
  }

  private fileNameFromPath(path: string): string {
    return this.normalizePath(path).split('/').pop() || path;
  }

  private normalizePath(path: string): string {
    return (path || '').replace(/\\/g, '/').trim();
  }

  private mergeHints(
    base: readonly BestCandidateHint[] | undefined,
    incoming: readonly BestCandidateHint[],
  ): BestCandidateHint[] {
    return Array.from(new Set([...(base ?? []), ...incoming]));
  }

  private toStrictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
  }
}
