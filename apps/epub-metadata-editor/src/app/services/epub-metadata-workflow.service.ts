import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  EpubMetadataEditorPageService,
  type EpubMetadataFormValue,
} from '@sheldrapps/ui-theme';
import {
  areEpubPackageMetadataEqual,
  EpubRewriteService,
  type EpubMetadataDocument,
  type EpubPackageMetadata,
} from '@sheldrapps/file-kit/native';
import { EpubMetadataLibraryService } from './epub-metadata-library.service';

type MetadataFile = {
  filename: string;
  sessionId?: string;
  workingNativePath?: string;
};

export interface CompletedMetadataFile {
  filename: string;
  metadata: EpubMetadataFormValue;
}

export interface PendingMetadataReview {
  filename: string;
  original: EpubMetadataFormValue;
  updated: EpubMetadataFormValue;
}

type PendingMetadataCommit =
  | {
      kind: 'working-file';
      file: MetadataFile;
      review: PendingMetadataReview;
    }
  | {
      kind: 'library-file';
      review: PendingMetadataReview;
    };

@Injectable({ providedIn: 'root' })
export class EpubMetadataWorkflowService {
  private readonly epubRewrite = inject(EpubRewriteService);
  private readonly metadataPage = inject(EpubMetadataEditorPageService);
  private readonly router = inject(Router);
  private readonly library = inject(EpubMetadataLibraryService);

  private pendingFiles: MetadataFile[] = [];
  private currentFile: MetadataFile | null = null;
  private formReturnIntent = false;
  private readonly completedFiles = signal<readonly CompletedMetadataFile[]>([]);
  private readonly pendingCommit = signal<PendingMetadataCommit | null>(null);

  readonly completedMetadata = this.completedFiles.asReadonly();
  readonly pendingReview = computed(() => this.pendingCommit()?.review ?? null);

  get hasPendingFiles(): boolean {
    return this.pendingFiles.length > 0;
  }

  async startFromNativePicker(multiple: boolean): Promise<void> {
    if (!this.epubRewrite.isSupported()) {
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
      workingNativePath: item.workingNativePath,
    }));
    await this.openNext();
  }

  async resumePending(): Promise<void> {
    if (!this.currentFile && this.pendingFiles.length > 0) {
      await this.openNext();
    }
  }

  async editCompleted(filename: string): Promise<void> {
    const current = await this.library.readMetadata(filename);
    if (!current) throw new Error('EPUB_METADATA_READ_FAILED');

    this.metadataPage.open({
      input: {
        version: current.version,
        detectedVersion: current.detectedVersion,
        fileName: filename,
        metadata: current.metadata,
      },
      returnUrl: '/tabs/edit',
      saveHandler: (metadata) =>
        this.stageLibraryMetadata(filename, current.metadata, metadata),
    });
    await this.router.navigateByUrl('/metadata-editor');
  }

  async cancel(): Promise<void> {
    await this.cleanupFile(this.currentFile);
    this.currentFile = null;
    this.pendingCommit.set(null);
    this.formReturnIntent = false;
    await this.clearPendingFiles();
    this.completedFiles.set([]);
    this.metadataPage.clear();
  }

  clearFormReturnIntent(): void {
    this.formReturnIntent = false;
  }

  consumeFormReturnIntent(): boolean {
    const shouldReturn = this.formReturnIntent;
    this.formReturnIntent = false;
    return shouldReturn;
  }

  async returnToModeSelection(): Promise<void> {
    await this.cleanupFile(this.currentFile);
    this.currentFile = null;
    this.pendingCommit.set(null);
    await this.clearPendingFiles();
    this.metadataPage.clear();
  }

  async reopenPendingReview(): Promise<void> {
    const pending = this.pendingCommit();
    if (!pending) return;

    const current =
      pending.kind === 'working-file'
        ? await this.readMetadata(pending.file)
        : await this.library.readMetadata(pending.review.filename);
    if (!current) throw new Error('EPUB_METADATA_READ_FAILED');

    this.pendingCommit.set(null);
    this.formReturnIntent = true;
    this.metadataPage.open({
      input: {
        version: current.version,
        detectedVersion: current.detectedVersion,
        fileName: pending.review.filename,
        metadata: pending.review.updated,
      },
      returnUrl: '/tabs/edit',
      saveHandler: (metadata) =>
        pending.kind === 'working-file'
          ? this.stageCurrentMetadata(
              pending.file,
              pending.review.original,
              metadata,
            )
          : this.stageLibraryMetadata(
              pending.review.filename,
              pending.review.original,
              metadata,
            ),
    });
    await this.router.navigateByUrl('/metadata-editor');
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
        saveHandler: (metadata) => this.stageCurrentMetadata(next, current.metadata, metadata),
        cancelHandler: () => this.cancel(),
      });
      this.formReturnIntent = true;
      await this.router.navigateByUrl('/metadata-editor');
    } catch (error) {
      await this.cleanupFile(next);
      this.currentFile = null;
      await this.clearPendingFiles();
      throw error;
    }
  }

  private async readMetadata(file: MetadataFile): Promise<EpubMetadataDocument> {
    if (!file.workingNativePath) {
      throw new Error('EPUB_METADATA_INPUT_UNAVAILABLE');
    }

    return this.epubRewrite.readEpubMetadata(file.workingNativePath);
  }

  private stageCurrentMetadata(
    file: MetadataFile,
    original: EpubMetadataFormValue,
    updated: EpubMetadataFormValue,
  ): void {
    if (this.currentFile !== file) throw new Error('EPUB_METADATA_INPUT_UNAVAILABLE');
    this.formReturnIntent = false;
    this.pendingCommit.set({
      kind: 'working-file',
      file,
      review: { filename: file.filename, original, updated },
    });
  }

  private stageLibraryMetadata(
    filename: string,
    original: EpubMetadataFormValue,
    updated: EpubMetadataFormValue,
  ): void {
    this.formReturnIntent = false;
    this.pendingCommit.set({
      kind: 'library-file',
      review: { filename, original, updated },
    });
  }

  async applyPendingChanges(): Promise<void> {
    const pending = this.pendingCommit();
    if (!pending) return;

    if (pending.kind === 'library-file') {
      await this.library.updateMetadata(
        pending.review.filename,
        pending.review.updated as EpubPackageMetadata,
      );
      this.completedFiles.update((completed) =>
        completed.map((file) =>
          file.filename === pending.review.filename
            ? { ...file, metadata: pending.review.updated }
            : file,
        ),
      );
    } else {
      await this.applyWorkingFileChanges(pending);
    }

    this.pendingCommit.set(null);
    if (pending.kind === 'working-file') {
      await this.cleanupFile(pending.file);
      this.currentFile = null;
      if (this.pendingFiles.length > 0) {
        await this.openNext();
      }
    }
  }

  private async applyWorkingFileChanges(
    pending: Extract<PendingMetadataCommit, { kind: 'working-file' }>,
  ): Promise<void> {
    const { file, review } = pending;
    if (!file.workingNativePath) throw new Error('EPUB_METADATA_INPUT_UNAVAILABLE');

    await this.epubRewrite.rewriteEpubMetadata(
      file.workingNativePath,
      review.updated as EpubPackageMetadata,
    );
    const publishedFilename = await this.library.publishWorkingEpub(
      review.filename,
      file.workingNativePath,
    );
    const persisted = await this.library.readMetadata(publishedFilename);
    if (!areEpubPackageMetadataEqual(persisted.metadata, review.updated)) {
      throw new Error('EPUB_METADATA_READ_AFTER_WRITE_MISMATCH');
    }

    this.completedFiles.update((completed) => [
      ...completed,
      { filename: publishedFilename, metadata: review.updated },
    ]);
  }

  private async clearPendingFiles(): Promise<void> {
    const pending = this.pendingFiles;
    this.pendingFiles = [];
    await Promise.all(pending.map((file) => this.cleanupFile(file)));
  }

  private async resetSelection(): Promise<void> {
    await this.cleanupFile(this.currentFile);
    this.currentFile = null;
    this.pendingCommit.set(null);
    this.formReturnIntent = false;
    await this.clearPendingFiles();
    this.completedFiles.set([]);
  }

  private async cleanupFile(file: MetadataFile | null): Promise<void> {
    if (file?.sessionId) {
      await this.epubRewrite.cleanup(file.sessionId).catch(() => undefined);
    }
  }
}
