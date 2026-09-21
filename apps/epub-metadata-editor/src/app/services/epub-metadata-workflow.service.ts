import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  EpubMetadataEditorPageService,
  type EpubMetadataFormValue,
} from '@sheldrapps/ui-theme';
import {
  areEpubPackageMetadataEqual,
  EpubRewriteService,
  FileKitService,
  readEpubMetadata,
  writeEpubMetadata,
  type EpubMetadataDocument,
  type EpubPackageMetadata,
} from '@sheldrapps/file-kit';
import { EpubMetadataLibraryService } from './epub-metadata-library.service';

type MetadataFile = {
  filename: string;
  file?: File;
  sessionId?: string;
  workingPath?: string;
  workingNativePath?: string;
};

export interface CompletedMetadataFile {
  filename: string;
  metadata: EpubMetadataFormValue;
}

@Injectable({ providedIn: 'root' })
export class EpubMetadataWorkflowService {
  private readonly fileKit = inject(FileKitService);
  private readonly epubRewrite = inject(EpubRewriteService);
  private readonly metadataPage = inject(EpubMetadataEditorPageService);
  private readonly router = inject(Router);
  private readonly library = inject(EpubMetadataLibraryService);

  private pendingFiles: MetadataFile[] = [];
  private currentFile: MetadataFile | null = null;
  private readonly completedFiles = signal<readonly CompletedMetadataFile[]>([]);

  readonly completedMetadata = this.completedFiles.asReadonly();

  get isNativeSupported(): boolean {
    return this.epubRewrite.isSupported();
  }

  get hasPendingFiles(): boolean {
    return this.pendingFiles.length > 0;
  }

  async startFromBrowserFiles(files: readonly File[]): Promise<void> {
    const validFiles = files.filter((file) => this.fileKit.validateEpub(file).valid);
    if (validFiles.length !== files.length || validFiles.length === 0) {
      throw new Error('EPUB_METADATA_INVALID_FILE');
    }

    await this.resetSelection();
    this.pendingFiles = validFiles.map((file) => ({
      filename: file.name,
      file,
    }));
    await this.openNext();
  }

  async startFromNativePicker(multiple: boolean): Promise<void> {
    if (!this.isNativeSupported) {
      throw new Error('EPUB_METADATA_NATIVE_PICKER_UNAVAILABLE');
    }

    await this.resetSelection();
    const prepared = multiple
      ? await this.epubRewrite.pickAndPrepareEpubs({
          requireCover: false,
          includeCoverPreview: false,
        })
      : [
          await this.epubRewrite.pickAndPrepareEpub({
            requireCover: false,
            includeCoverPreview: false,
          }),
        ];

    this.pendingFiles = prepared.map((item) => ({
      filename: item.selectedName,
      sessionId: item.sessionId,
      workingPath: item.workingPath,
      workingNativePath: item.workingNativePath,
    }));
    await this.openNext();
  }

  async resumePending(): Promise<void> {
    if (!this.currentFile && this.pendingFiles.length > 0) {
      await this.openNext();
    }
  }

  async cancel(): Promise<void> {
    await this.cleanupFile(this.currentFile);
    this.currentFile = null;
    await this.clearPendingFiles();
    this.completedFiles.set([]);
    this.metadataPage.clear();
  }

  private async openNext(): Promise<void> {
    const next = this.pendingFiles.shift();
    if (!next) return;

    this.currentFile = next;
    try {
      const current = await this.readMetadata(next);
      this.metadataPage.open({
        input: {
          version: current.version,
          detectedVersion: current.detectedVersion,
          fileName: next.filename,
          metadata: current.metadata,
        },
        returnUrl: '/tabs/edit',
        saveHandler: (metadata) => this.saveCurrent(metadata),
        cancelHandler: () => this.cancel(),
      });
      await this.router.navigateByUrl('/metadata-editor');
    } catch (error) {
      await this.cleanupFile(next);
      this.currentFile = null;
      await this.clearPendingFiles();
      throw error;
    }
  }

  private async readMetadata(file: MetadataFile): Promise<EpubMetadataDocument> {
    if (file.file) {
      const bytes = new Uint8Array(await file.file.arrayBuffer());
      const metadata = await readEpubMetadata(bytes);
      if (!metadata) throw new Error('EPUB_METADATA_READ_FAILED');
      return metadata;
    }

    if (!file.workingNativePath) {
      throw new Error('EPUB_METADATA_INPUT_UNAVAILABLE');
    }

    return this.epubRewrite.readEpubMetadata(file.workingNativePath);
  }

  private async saveCurrent(metadata: EpubMetadataFormValue): Promise<void> {
    const file = this.currentFile;
    if (!file) throw new Error('EPUB_METADATA_INPUT_UNAVAILABLE');

    if (file.file) {
      const bytes = new Uint8Array(await file.file.arrayBuffer());
      const updated = await writeEpubMetadata(bytes, metadata as EpubPackageMetadata);
      const persisted = await readEpubMetadata(updated);
      if (!persisted || !areEpubPackageMetadataEqual(persisted.metadata, metadata)) {
        throw new Error('EPUB_METADATA_READ_AFTER_WRITE_MISMATCH');
      }
      await this.library.saveEpub(file.filename, updated);
    } else {
      await this.epubRewrite.rewriteEpubMetadata(
        file.workingNativePath!,
        metadata as EpubPackageMetadata,
      );
      const persisted = await this.epubRewrite.readEpubMetadata(file.workingNativePath!);
      if (!areEpubPackageMetadataEqual(persisted.metadata, metadata)) {
        throw new Error('EPUB_METADATA_READ_AFTER_WRITE_MISMATCH');
      }
      if (!file.workingPath) throw new Error('EPUB_METADATA_OUTPUT_UNAVAILABLE');
      const bytes = await this.fileKit.readBytes({ dir: 'Cache', path: file.workingPath });
      await this.library.saveEpub(file.filename, bytes);
    }

    this.completedFiles.update((completed) => [
      ...completed,
      { filename: file.filename, metadata },
    ]);

    await this.cleanupFile(file);
    this.currentFile = null;
  }

  private async clearPendingFiles(): Promise<void> {
    const pending = this.pendingFiles;
    this.pendingFiles = [];
    await Promise.all(pending.map((file) => this.cleanupFile(file)));
  }

  private async resetSelection(): Promise<void> {
    await this.clearPendingFiles();
    this.completedFiles.set([]);
  }

  private async cleanupFile(file: MetadataFile | null): Promise<void> {
    if (file?.sessionId) {
      await this.epubRewrite.cleanup(file.sessionId).catch(() => undefined);
    }
  }
}
