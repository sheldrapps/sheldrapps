import { Injectable, inject } from '@angular/core';
import {
  areEpubPackageMetadataEqual,
  EpubRewriteService,
  FileKitService,
  type EpubPackageMetadata,
} from '@sheldrapps/file-kit/native';

const EME_PUBLIC_FOLDER = 'EPUBMetadataEditor';
const EPUB_MIME_TYPE = 'application/epub+zip';

@Injectable({ providedIn: 'root' })
export class EpubMetadataLibraryService {
  private readonly fileKit = inject(FileKitService);
  private readonly epubRewrite = inject(EpubRewriteService);

  async listEpubs(): Promise<string[]> {
    this.requireNativeSupport();
    const files = await this.epubRewrite.listPublicDocuments(EME_PUBLIC_FOLDER, '.epub');
    return files.map((file) => file.name).sort((left, right) => left.localeCompare(right));
  }

  async publishWorkingEpub(filename: string, sourcePath: string): Promise<string> {
    this.requireNativeSupport();
    const resolved = this.ensureEpubFilename(filename);
    await this.epubRewrite.ensurePublicExportFolder(EME_PUBLIC_FOLDER);
    const published = await this.epubRewrite.publishPublicDocument({
      folderName: EME_PUBLIC_FOLDER,
      sourcePath,
      outputName: resolved,
      mimeType: EPUB_MIME_TYPE,
    });
    return published.filename;
  }

  async readMetadata(filename: string) {
    this.requireNativeSupport();
    return this.epubRewrite.readPublicEpubMetadata(
      EME_PUBLIC_FOLDER,
      this.ensureEpubFilename(filename),
    );
  }

  async updateMetadata(filename: string, metadata: EpubPackageMetadata): Promise<void> {
    this.requireNativeSupport();
    const resolved = this.ensureEpubFilename(filename);
    await this.epubRewrite.rewritePublicEpubMetadata(
      EME_PUBLIC_FOLDER,
      resolved,
      metadata,
    );
    await this.verifyMetadata(resolved, metadata);
  }

  async deleteByFilename(filename: string): Promise<void> {
    this.requireNativeSupport();
    await this.epubRewrite.deletePublicDocument(
      EME_PUBLIC_FOLDER,
      this.ensureEpubFilename(filename),
    );
  }

  async renameByFilename(filename: string, requestedName: string): Promise<string> {
    this.requireNativeSupport();
    const resolved = this.ensureEpubFilename(filename);
    const usedNames = new Set((await this.listEpubs()).filter((item) => item !== resolved));
    const nextFilename = this.resolveUniqueFilename(requestedName, usedNames);
    if (resolved === nextFilename) return resolved;

    await this.epubRewrite.renamePublicDocument(
      EME_PUBLIC_FOLDER,
      resolved,
      nextFilename,
    );
    return nextFilename;
  }

  async openByFilename(filename: string): Promise<void> {
    this.requireNativeSupport();
    const resolved = this.ensureEpubFilename(filename);
    const uri = await this.resolveUri(resolved);
    await this.epubRewrite.openExternalFile({
      inputPath: uri,
      mimeType: EPUB_MIME_TYPE,
      chooserTitle: resolved,
    });
  }

  async shareByFilename(filename: string): Promise<void> {
    this.requireNativeSupport();
    const resolved = this.ensureEpubFilename(filename);
    const uri = await this.resolveUri(resolved);
    await this.fileKit.share(
      { uri, filename: resolved, mimeType: EPUB_MIME_TYPE },
      { title: resolved, dialogTitle: 'Share EPUB' },
    );
  }

  private async resolveUri(filename: string): Promise<string> {
    return (await this.epubRewrite.getPublicDocument(EME_PUBLIC_FOLDER, filename)).uri;
  }

  private async verifyMetadata(filename: string, metadata: EpubPackageMetadata): Promise<void> {
    const persisted = await this.readMetadata(filename);
    if (!areEpubPackageMetadataEqual(persisted.metadata, metadata)) {
      throw new Error('EPUB_METADATA_READ_AFTER_WRITE_MISMATCH');
    }
  }

  private requireNativeSupport(): void {
    if (!this.epubRewrite.isSupported()) {
      throw new Error('EPUB_METADATA_NATIVE_UNAVAILABLE');
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
