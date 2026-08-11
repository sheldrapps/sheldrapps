export interface PdfLibraryEntry {
  id: string;
  operationId: string;
  operation: 'merge' | 'split';
  fileName: string;
  title: string;
  uri: string;
  sizeBytes: number;
  pageCount: number;
  createdAt: string;
  partIndex?: number;
  totalParts?: number;
  thumbnailUri?: string;
}
