import { Injectable } from '@angular/core';

import type { PdfLibraryEntry } from '../pdf/pdf-library.types';

@Injectable({ providedIn: 'root' })
export class PdfLibraryService {
  private readonly storageKey = 'pmas.pdf-library-index';

  async listRecords(): Promise<PdfLibraryEntry[]> {
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
    const records = await this.listRecords();
    const next = [record, ...records.filter((item) => item.id !== record.id)];
    localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  async deleteRecord(id: string): Promise<void> {
    const records = await this.listRecords();
    localStorage.setItem(
      this.storageKey,
      JSON.stringify(records.filter((record) => record.id !== id)),
    );
  }
}
