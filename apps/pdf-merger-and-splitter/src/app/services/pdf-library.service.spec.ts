import { PdfLibraryService } from './pdf-library.service';
import type { PdfLibraryEntry } from '../pdf/pdf-library.types';
import { PdfRewriteNativeService } from '../pdf/pdf-rewrite.service';

describe('PdfLibraryService', () => {
  const storageKey = 'pmas.pdf-library-index';
  const thumbnailPrefix = 'pmas.pdf-library-thumbnail:';

  const thumbnailUri = 'data:image/jpeg;base64,thumbnail';

  const record: PdfLibraryEntry = {
    id: 'operation-1:0',
    operationId: 'operation-1',
    operation: 'merge',
    fileName: 'book.pdf',
    title: 'book',
    uri: 'content://pdf/book.pdf',
    sizeBytes: 42,
    pageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    thumbnailUri,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates legacy thumbnails out of the library index', async () => {
    localStorage.setItem(storageKey, JSON.stringify([record]));
    const service = new PdfLibraryService(
      { isNativeSupported: () => false } as PdfRewriteNativeService,
    );

    const records = await service.listRecords();
    const storedRecords = JSON.parse(localStorage.getItem(storageKey) || '[]') as PdfLibraryEntry[];

    expect(records[0].thumbnailUri).toBe(thumbnailUri);
    expect(storedRecords[0].thumbnailUri).toBeUndefined();
    expect(
      localStorage.getItem(thumbnailPrefix + encodeURIComponent(record.uri)),
    ).toBe(thumbnailUri);
  });

  it('keeps thumbnails separate when saving and deleting records', async () => {
    const service = new PdfLibraryService(
      { isNativeSupported: () => false } as PdfRewriteNativeService,
    );

    await service.saveRecord(record);

    const storedRecords = JSON.parse(localStorage.getItem(storageKey) || '[]') as PdfLibraryEntry[];
    expect(storedRecords[0].thumbnailUri).toBeUndefined();
    expect(
      localStorage.getItem(thumbnailPrefix + encodeURIComponent(record.uri)),
    ).toBe(thumbnailUri);

    await service.deleteRecord(record);

    expect(localStorage.getItem(storageKey)).toBe('[]');
    expect(
      localStorage.getItem(thumbnailPrefix + encodeURIComponent(record.uri)),
    ).toBeNull();
  });
});