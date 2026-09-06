import { Injectable } from '@angular/core';
import type { PdfLibraryEntry } from '../pdf/pdf-library.types';
import { PdfRewriteNativeService } from '../pdf/pdf-rewrite.service';

@Injectable({ providedIn: 'root' })
export class PdfLibraryService {
  private readonly storageKey = 'pmas.pdf-library-index';
  private readonly thumbnailStoragePrefix = 'pmas.pdf-library-thumbnail:';

  constructor(private readonly rewrite: PdfRewriteNativeService) {}

  async listRecords(): Promise<PdfLibraryEntry[]> {
    const storedRecords = this.readStoredRecords();

    if (this.rewrite.isNativeSupported()) {
      const files = await this.rewrite.listLocalPdfs();
      return files.map((file) => {
        const stored = this.findStoredRecord(
          storedRecords,
          file.uri,
          file.displayName,
        );
        return {
          id: file.uri,
          operationId: stored?.operationId ?? file.uri,
          operation: stored?.operation ?? 'merge',
          fileName: file.displayName,
          title: file.displayName.replace(/\.pdf$/i, ''),
          uri: file.uri,
          sizeBytes: file.sizeBytes,
          pageCount: 0,
          createdAt: new Date(file.modifiedAtMillis).toISOString(),
          thumbnailUri: stored ? this.readStoredThumbnail(stored) : undefined,
        };
      });
    }

    return storedRecords.map((record) => ({
      ...record,
      thumbnailUri: this.readStoredThumbnail(record),
    }));
  }

  async saveRecord(record: PdfLibraryEntry): Promise<void> {
    this.syncStoredThumbnail(record);
    const normalizedRecord = this.withoutThumbnail(record);

    if (this.rewrite.isNativeSupported()) {
      const records = this.readStoredRecords();
      this.writeStoredRecords([
        normalizedRecord,
        ...records.filter(
          (item) => item.id !== record.id && item.uri !== record.uri,
        ),
      ]);
      return;
    }

    const records = await this.listRecords();
    const next = [
      normalizedRecord,
      ...records.filter((item) => item.id !== record.id),
    ];
    this.writeStoredRecords(next);
  }

  async deleteRecord(record: PdfLibraryEntry): Promise<void> {
    if (this.rewrite.isNativeSupported()) {
      await this.rewrite.deleteLocalPdf(record.uri);
      this.removeStoredThumbnail(record);
      this.writeStoredRecords(
        this.readStoredRecords().filter(
          (item) => item.uri !== record.uri && item.id !== record.id,
        ),
      );
      return;
    }

    this.removeStoredThumbnail(record);
    const records = await this.listRecords();
    this.writeStoredRecords(
      records.filter((item) => item.id !== record.id),
    );
  }

  async renameRecord(record: PdfLibraryEntry, title: string): Promise<void> {
    const fileName = title.replace(/\.pdf$/i, '') + '.pdf';
    if (this.rewrite.isNativeSupported()) {
      await this.rewrite.renameLocalPdf(record.uri, fileName);
      this.writeStoredRecords(
        this.readStoredRecords().map((item) =>
          item.uri === record.uri || item.id === record.id
            ? { ...item, fileName, title }
            : item,
        ),
      );
      return;
    }
    await this.saveRecord({ ...record, title, fileName });
  }

  async openRecord(record: PdfLibraryEntry): Promise<void> {
    await this.rewrite.openLocalPdf(record.uri);
  }

  async shareRecord(record: PdfLibraryEntry): Promise<void> {
    await this.rewrite.shareLocalPdf(record.uri, record.title);
  }

  private readStoredRecords(): PdfLibraryEntry[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(this.storageKey);
      const records = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(records)) {
        return [];
      }

      let migrated = false;
      const normalized = records.map((value) => {
        const record = value as PdfLibraryEntry;
        if (typeof record.thumbnailUri === 'string') {
          if (this.persistStoredThumbnail(record)) {
            migrated = true;
            return this.withoutThumbnail(record);
          }
          return record;
        }
        return this.withoutThumbnail(record);
      });

      if (migrated) {
        this.writeStoredRecords(normalized);
      }

      return normalized;
    } catch {
      return [];
    }
  }

  private writeStoredRecords(records: PdfLibraryEntry[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(records.map((record) => this.withoutThumbnail(record))),
    );
  }

  private findStoredRecord(
    records: readonly PdfLibraryEntry[],
    uri: string,
    fileName: string,
  ): PdfLibraryEntry | undefined {
    return records.find(
      (record) => record.uri === uri || record.fileName === fileName,
    );
  }

  private syncStoredThumbnail(record: PdfLibraryEntry): void {
    if (
      typeof record.thumbnailUri === 'string' &&
      record.thumbnailUri.length > 0
    ) {
      this.persistStoredThumbnail(record);
      return;
    }
    this.removeStoredThumbnail(record);
  }

  private persistStoredThumbnail(record: PdfLibraryEntry): boolean {
    if (
      typeof localStorage === 'undefined' ||
      typeof record.thumbnailUri !== 'string' ||
      record.thumbnailUri.length === 0
    ) {
      return false;
    }

    try {
      localStorage.setItem(
        this.thumbnailStorageKey(record),
        record.thumbnailUri,
      );
      return true;
    } catch {
      return false;
    }
  }

  private readStoredThumbnail(record: PdfLibraryEntry): string | undefined {
    if (typeof localStorage === 'undefined') {
      return undefined;
    }

    try {
      return localStorage.getItem(this.thumbnailStorageKey(record)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private removeStoredThumbnail(record: PdfLibraryEntry): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(this.thumbnailStorageKey(record));
    } catch {
      return;
    }
  }

  private thumbnailStorageKey(record: PdfLibraryEntry): string {
    return (
      this.thumbnailStoragePrefix +
      encodeURIComponent(record.uri || record.id || record.fileName)
    );
  }

  private withoutThumbnail(record: PdfLibraryEntry): PdfLibraryEntry {
    const normalized = { ...record };
    delete normalized.thumbnailUri;
    return normalized;
  }
}
