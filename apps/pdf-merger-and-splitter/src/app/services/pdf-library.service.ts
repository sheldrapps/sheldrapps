import { Injectable } from '@angular/core';

import type { PdfLibraryEntry } from '../pdf/pdf-library.types';
import { PdfRewriteNativeService } from '../pdf/pdf-rewrite.service';

@Injectable({ providedIn: 'root' })
export class PdfLibraryService {
  private readonly storageKey = 'pmas.pdf-library-index';

  constructor(private readonly rewrite: PdfRewriteNativeService) {}

  async listRecords(): Promise<PdfLibraryEntry[]> {
    if (this.rewrite.isNativeSupported()) {
      const files = await this.rewrite.listLocalPdfs();
      const storedRecords = this.readStoredRecords();
      return files.map((file) => ({
        id: file.uri,
        operationId: storedRecords.find((record) => record.uri === file.uri || record.fileName === file.displayName)?.operationId ?? file.uri,
        operation: storedRecords.find((record) => record.uri === file.uri || record.fileName === file.displayName)?.operation ?? 'merge',
        fileName: file.displayName,
        title: file.displayName.replace(/\.pdf$/i, ''),
        uri: file.uri,
        sizeBytes: file.sizeBytes,
        pageCount: 0,
        createdAt: new Date(file.modifiedAtMillis).toISOString(),
        thumbnailUri: storedRecords.find((record) => record.uri === file.uri || record.fileName === file.displayName)?.thumbnailUri,
      }));
    }
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }
    try {
      const records = JSON.parse(raw) as unknown;
      return Array.isArray(records) ? (records as PdfLibraryEntry[]) : [];
    } catch {
      return [];
    }
  }

  async saveRecord(record: PdfLibraryEntry): Promise<void> {
    if (this.rewrite.isNativeSupported()) {
      const records = this.readStoredRecords();
      this.writeStoredRecords([record, ...records.filter((item) => item.id !== record.id && item.uri !== record.uri)]);
      return;
    }
    const records = await this.listRecords();
    const next = [record, ...records.filter((item) => item.id !== record.id)];
    localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  async deleteRecord(record: PdfLibraryEntry): Promise<void> {
    if (this.rewrite.isNativeSupported()) {
      await this.rewrite.deleteLocalPdf(record.uri);
      this.writeStoredRecords(this.readStoredRecords().filter((item) => item.uri !== record.uri && item.id !== record.id));
      return;
    }
    const records = await this.listRecords();
    localStorage.setItem(
      this.storageKey,
      JSON.stringify(records.filter((item) => item.id !== record.id)),
    );
  }

  async renameRecord(record: PdfLibraryEntry, title: string): Promise<void> {
    const fileName = `${title.replace(/\.pdf$/i, '')}.pdf`;
    if (this.rewrite.isNativeSupported()) {
      await this.rewrite.renameLocalPdf(record.uri, fileName);
      this.writeStoredRecords(this.readStoredRecords().map((item) =>
        item.uri === record.uri || item.id === record.id
          ? { ...item, fileName, title }
          : item,
      ));
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
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      const records = raw ? JSON.parse(raw) as unknown : [];
      return Array.isArray(records) ? records as PdfLibraryEntry[] : [];
    } catch {
      return [];
    }
  }

  private writeStoredRecords(records: PdfLibraryEntry[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(records));
    }
  }
}
