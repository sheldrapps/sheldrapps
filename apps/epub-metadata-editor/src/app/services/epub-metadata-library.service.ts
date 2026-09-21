import { Directory } from '@capacitor/filesystem';
import { Injectable, inject } from '@angular/core';
import {
  EpubPublicStore,
  EpubRewriteService,
  FileKitService,
  PUBLIC_FILESYSTEM,
  areEpubPackageMetadataEqual,
  readEpubMetadata,
  writeEpubMetadata,
  type EpubPackageMetadata,
} from '@sheldrapps/file-kit';

const EME_PUBLIC_FOLDER = 'EPUBMetadataEditor';
const EPUB_MIME_TYPE = 'application/epub+zip';

@Injectable({ providedIn: 'root' })
export class EpubMetadataLibraryService {
  private readonly fileKit = inject(FileKitService);
  private readonly epubRewrite = inject(EpubRewriteService);
  private readonly publicFilesystem = inject(PUBLIC_FILESYSTEM);
  private readonly epubStore = new EpubPublicStore(this.fileKit, {
    epubFolder: EME_PUBLIC_FOLDER,
    useDocumentsDirectoryOnNative: true,
    nativeDirectory: Directory.Documents,
    legacyNativeDirectories: [Directory.Data],
    filesystem: this.publicFilesystem,
    logPrefix: 'EME:library',
  });

  async listEpubs(): Promise<string[]> {
    if (this.epubRewrite.isSupported()) {
      const files = await this.epubRewrite.listPublicDocuments(EME_PUBLIC_FOLDER, '.epub');
      return files.map((file) => file.name).sort((left, right) => left.localeCompare(right));
    }
    return this.epubStore.listEpubs();
  }

  async saveEpub(filename: string, bytes: Uint8Array): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    if (!this.epubRewrite.isSupported()) {
      await this.epubStore.writeEpub(resolved, bytes);
      return;
    }

    const stagingPath = `${EME_PUBLIC_FOLDER}/.metadata_${Date.now()}_${resolved}`;
    try {
      await this.fileKit.writeBytes({
        dir: 'Data',
        path: stagingPath,
        bytes,
        mimeType: EPUB_MIME_TYPE,
      });
      const sourceUri = await this.fileKit.getUri({ dir: 'Data', path: stagingPath });
      await this.epubRewrite.ensurePublicExportFolder(EME_PUBLIC_FOLDER);
      await this.epubRewrite.publishPublicDocument({
        folderName: EME_PUBLIC_FOLDER,
        sourcePath: sourceUri,
        outputName: resolved,
        mimeType: EPUB_MIME_TYPE,
      });
    } finally {
      await this.fileKit.delete({ dir: 'Data', path: stagingPath }).catch(() => undefined);
    }
  }

  async readBytes(filename: string): Promise<Uint8Array> {
    const resolved = this.ensureEpubFilename(filename);
    if (this.epubRewrite.isSupported()) {
      const document = await this.epubRewrite.getPublicDocument(EME_PUBLIC_FOLDER, resolved);
      return this.readUriBytes(document.uri);
    }
    return this.epubStore.readBytes(resolved);
  }

  async readMetadata(filename: string) {
    const bytes = await this.readBytes(filename);
    return readEpubMetadata(bytes);
  }

  async updateMetadata(filename: string, metadata: EpubPackageMetadata): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    if (this.epubRewrite.isSupported()) {
      await this.epubRewrite.rewritePublicEpubMetadata(EME_PUBLIC_FOLDER, resolved, metadata);
      await this.verifyMetadata(resolved, metadata);
      return;
    }

    const bytes = await this.readBytes(resolved);
    const updated = await writeEpubMetadata(bytes, metadata);
    await this.saveEpub(resolved, updated);
    await this.verifyMetadata(resolved, metadata);
  }

  async deleteByFilename(filename: string): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    if (this.epubRewrite.isSupported()) {
      await this.epubRewrite.deletePublicDocument(EME_PUBLIC_FOLDER, resolved);
      return;
    }
    await this.epubStore.deleteEpub(resolved);
  }

  async renameByFilename(filename: string, requestedName: string): Promise<string> {
    const resolved = this.ensureEpubFilename(filename);
    const usedNames = new Set((await this.listEpubs()).filter((item) => item !== resolved));
    const nextFilename = this.resolveUniqueFilename(requestedName, usedNames);
    if (resolved === nextFilename) return resolved;

    if (this.epubRewrite.isSupported()) {
      await this.epubRewrite.renamePublicDocument(EME_PUBLIC_FOLDER, resolved, nextFilename);
    } else {
      await this.epubStore.renameEpub(resolved, nextFilename);
    }
    return nextFilename;
  }

  async openByFilename(filename: string): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    const uri = await this.resolveUri(resolved);
    if (this.epubRewrite.isSupported()) {
      await this.epubRewrite.openExternalFile({
        inputPath: uri,
        mimeType: EPUB_MIME_TYPE,
        chooserTitle: resolved,
      });
      return;
    }
    await this.fileKit.share(
      { uri, filename: resolved, mimeType: EPUB_MIME_TYPE },
      { title: resolved, dialogTitle: 'Open EPUB' },
    );
  }

  async shareByFilename(filename: string): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    const uri = await this.resolveUri(resolved);
    await this.fileKit.share(
      { uri, filename: resolved, mimeType: EPUB_MIME_TYPE },
      { title: resolved, dialogTitle: 'Share EPUB' },
    );
  }

  private async resolveUri(filename: string): Promise<string> {
    if (this.epubRewrite.isSupported()) {
      return (await this.epubRewrite.getPublicDocument(EME_PUBLIC_FOLDER, filename)).uri;
    }
    return this.epubStore.getUriOrThrow(filename);
  }

  private async readUriBytes(uri: string): Promise<Uint8Array> {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('EPUB_METADATA_READ_FAILED');
    return new Uint8Array(await response.arrayBuffer());
  }

  private async verifyMetadata(filename: string, metadata: EpubPackageMetadata): Promise<void> {
    const persisted = await this.readMetadata(filename);
    if (!persisted || !areEpubPackageMetadataEqual(persisted.metadata, metadata)) {
      throw new Error('EPUB_METADATA_READ_AFTER_WRITE_MISMATCH');
    }
  }

  private ensureEpubFilename(name: string): string {
    const trimmed = (name || 'book.epub').trim();
    return /\.epub$/i.test(trimmed) ? trimmed : `${trimmed}.epub`;
  }

  private resolveUniqueFilename(requestedName: string, usedNames: ReadonlySet<string>): string {
    const filename = this.ensureEpubFilename(requestedName);
    if (!usedNames.has(filename)) return filename;

    const baseName = filename.replace(/\.epub$/i, '');
    let index = 1;
    let candidate = filename;
    while (usedNames.has(candidate)) {
      candidate = `${baseName} (${index}).epub`;
      index += 1;
    }
    return candidate;
  }
}
