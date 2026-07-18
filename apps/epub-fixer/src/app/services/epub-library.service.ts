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

type PersistedPreviewAsset = {
  mimeType: string;
  dataBase64: string;
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
  private readonly previewThumbFolder = 'EPUBFixerThumbs';

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
    await this.deletePersistedPreviewAsset(filename);
    this.previewCache.delete(filename);
    await this.refreshPreviewAsset(filename).catch(() => void 0);
  }

  async loadGeneratedEpubByFilename(
    filename: string,
  ): Promise<LoadedGeneratedEpub | null> {
    const resolved = this.ensureEpubFilename(filename);

    if (this.epubRewrite.isSupported()) {
      try {
        const [uri, size] = await Promise.all([
          this.epubStore.getUriOrThrow(resolved),
          this.epubStore.getFileSizeOrThrow(resolved).catch(() => 0),
        ]);

        return {
          file: new File([], resolved, {
            type: 'application/epub+zip',
          }),
          uri,
          size,
        };
      } catch {
        // Fall back to reading bytes below when the native URI path is unavailable.
      }
    }

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
    await this.deletePersistedPreviewAsset(resolved);
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

      const persisted = await this.readPersistedPreviewAsset(cacheKey);
      if (persisted) {
        this.previewCache.set(cacheKey, persisted);
        return persisted;
      }
    }

    const resolved = await this.refreshPreviewAsset(cacheKey);
    if (!resolved) {
      const unavailable = { src: '', isDithered: false };
      this.previewCache.set(cacheKey, unavailable);
      return unavailable;
    }
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

  private async refreshPreviewAsset(
    filename: string,
  ): Promise<LibraryPreviewAsset | null> {
    const coverFile = await this.extractCoverFile(filename);
    if (!coverFile) {
      return null;
    }

    const asset = await this.persistPreviewAsset(filename, coverFile);
    this.previewCache.set(filename, asset);
    return asset;
  }

  private previewThumbPath(filename: string): string {
    return `${this.previewThumbFolder}/${this.fileKit.makeSafeFilename(
      filename,
      'json',
    )}`;
  }

  private async readPersistedPreviewAsset(
    filename: string,
  ): Promise<LibraryPreviewAsset | null> {
    const path = this.previewThumbPath(filename);
    const exists = await this.fileKit.exists({
      dir: 'Data',
      path,
    });
    if (!exists) {
      return null;
    }

    try {
      const raw = await this.fileKit.readBytes({
        dir: 'Data',
        path,
      });
      const text = new TextDecoder().decode(raw);
      const parsed = JSON.parse(text) as Partial<PersistedPreviewAsset>;
      if (
        !parsed ||
        typeof parsed.mimeType !== 'string' ||
        typeof parsed.dataBase64 !== 'string' ||
        !parsed.dataBase64.trim()
      ) {
        return null;
      }

      return {
        src: `data:${parsed.mimeType};base64,${parsed.dataBase64}`,
        isDithered: !!parsed.isDithered,
      };
    } catch {
      return null;
    }
  }

  private async persistPreviewAsset(
    filename: string,
    coverFile: File,
  ): Promise<LibraryPreviewAsset> {
    const bytes = new Uint8Array(await coverFile.arrayBuffer());
    const mimeType = coverFile.type || 'image/jpeg';
    const dataBase64 = this.fileKit.toBase64(bytes);
    const payload: PersistedPreviewAsset = {
      mimeType,
      dataBase64,
      isDithered: false,
    };

    await this.fileKit.writeBytes({
      dir: 'Data',
      path: this.previewThumbPath(filename),
      bytes: new TextEncoder().encode(JSON.stringify(payload)),
      mimeType: 'application/json',
    });

    return {
      src: `data:${mimeType};base64,${dataBase64}`,
      isDithered: false,
    };
  }

  private async deletePersistedPreviewAsset(filename: string): Promise<void> {
    try {
      await this.fileKit.delete({
        dir: 'Data',
        path: this.previewThumbPath(filename),
      });
    } catch {
      // best effort
    }
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

}
