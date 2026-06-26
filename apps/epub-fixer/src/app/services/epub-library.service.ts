import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  EpubPublicStore,
  FileKitService,
  EpubRewriteService,
  WEB_EPUB_COVER_SERVICE_TOKEN,
  type WebEpubCoverService,
} from '@sheldrapps/file-kit';

export type LibraryPreviewAsset = {
  src: string;
  isDithered: boolean;
};

export type LoadedGeneratedEpub = {
  file: File;
  uri: string | null;
  size: number;
};

@Injectable({ providedIn: 'root' })
export class EpubLibraryService {
  private readonly fileKit = inject(FileKitService);
  private readonly epubRewrite = inject(EpubRewriteService);
  private readonly webEpubCover = inject(WEB_EPUB_COVER_SERVICE_TOKEN, {
    optional: true,
  }) as WebEpubCoverService | null;

  private readonly epubStore = new EpubPublicStore(this.fileKit, {
    epubFolder: 'EPUBFixer',
    logPrefix: 'EF:library',
  });

  private readonly previewCache = new Map<string, LibraryPreviewAsset>();

  async listEpubs(): Promise<string[]> {
    return this.epubStore.listEpubs();
  }

  async saveExportedEpub(
    sourceUri: string,
    outputName: string,
  ): Promise<void> {
    const filename = this.ensureEpubFilename(outputName);
    const bytes = await this.readExportBytes(sourceUri);
    await this.epubStore.writeEpub(filename, bytes);
    this.previewCache.delete(filename);
  }

  async loadGeneratedEpubByFilename(
    filename: string,
  ): Promise<LoadedGeneratedEpub | null> {
    const resolved = this.ensureEpubFilename(filename);

    try {
      const bytes = await this.epubStore.readBytes(resolved);
      const epubBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      let uri: string | null = null;
      try {
        uri = await this.epubStore.getUriOrThrow(resolved);
      } catch {
        uri = null;
      }

      return {
        file: new File([epubBuffer], resolved, {
          type: 'application/epub+zip',
        }),
        uri,
        size: bytes.byteLength,
      };
    } catch {
      return null;
    }
  }

  async deleteByFilename(filename: string): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    await this.epubStore.deleteEpub(resolved);
    this.previewCache.delete(resolved);
  }

  async shareByFilename(filename: string): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    const uri = await this.epubStore.getUriOrThrow(resolved);
    await this.fileKit.share(
      {
        uri,
        filename: resolved,
        mimeType: 'application/epub+zip',
      },
      {
        title: resolved,
        text: 'EPUB Fixer',
        dialogTitle: 'Share EPUB',
      },
    );
  }

  async openByFilename(filename: string): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    const uri = await this.epubStore.getUriOrThrow(resolved);

    if (!this.epubRewrite.isSupported()) {
      await this.fileKit.share(
        {
          uri,
          filename: resolved,
          mimeType: 'application/epub+zip',
        },
        {
          title: resolved,
          text: 'EPUB Fixer',
          dialogTitle: 'Open EPUB',
        },
      );
      return;
    }

    await this.epubRewrite.openExternalFile({
      inputPath: uri,
      mimeType: 'application/epub+zip',
      chooserTitle: 'Open EPUB',
    });
  }

  async getFileSizeBytes(filename: string): Promise<number | null> {
    try {
      return (
        await this.epubStore.readBytes(this.ensureEpubFilename(filename))
      ).byteLength;
    } catch {
      return null;
    }
  }

  async resolvePreviewAsset(
    filename: string,
    opts?: { forceRefresh?: boolean },
  ): Promise<LibraryPreviewAsset> {
    const cacheKey = this.ensureEpubFilename(filename);
    if (!opts?.forceRefresh) {
      const cached = this.previewCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const coverFile = await this.extractCoverFile(cacheKey);
    if (!coverFile) {
      const unavailable = { src: '', isDithered: false };
      this.previewCache.set(cacheKey, unavailable);
      return unavailable;
    }

    const src = await this.fileToDataUrl(coverFile);
    const resolved = { src, isDithered: false };
    this.previewCache.set(cacheKey, resolved);
    return resolved;
  }

  private async extractCoverFile(filename: string): Promise<File | null> {
    if (this.epubRewrite.isSupported()) {
      const uri = await this.epubStore.getUriOrThrow(filename);
      const extracted = await this.epubRewrite.extractCoverAssetFile({
        epubPath: uri,
        epubName: filename,
        maxBytes: 30 * 1024 * 1024,
      });
      return extracted.file;
    }

    if (!this.webEpubCover) {
      return null;
    }

    const bytes = await this.epubStore.readBytes(filename);
    const epubBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const epubFile = new File([epubBuffer], filename, {
      type: 'application/epub+zip',
    });
    return this.webEpubCover.extractCover(epubFile);
  }

  private async readExportBytes(sourceUri: string): Promise<Uint8Array> {
    const fetchUrl = this.toFetchUrl(sourceUri);
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to read export output: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  private toFetchUrl(sourceUri: string): string {
    if (!sourceUri) {
      return sourceUri;
    }

    if (
      sourceUri.startsWith('blob:') ||
      sourceUri.startsWith('http:') ||
      sourceUri.startsWith('https:')
    ) {
      return sourceUri;
    }

    const nativePath = this.toNativePath(sourceUri);
    return Capacitor.convertFileSrc(nativePath);
  }

  private toNativePath(uriOrPath: string): string {
    if (uriOrPath.startsWith('file://')) {
      return decodeURIComponent(uriOrPath.replace(/^file:\/\//, ''));
    }
    return uriOrPath;
  }

  private ensureEpubFilename(name: string): string {
    const trimmed = (name || 'book.epub').trim();
    return /\.epub$/i.test(trimmed) ? trimmed : `${trimmed}.epub`;
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : '');
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error('Unable to read preview file'));
      };
      reader.readAsDataURL(file);
    });
  }
}
