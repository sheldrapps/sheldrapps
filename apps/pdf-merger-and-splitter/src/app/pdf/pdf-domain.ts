export type PdfOperation = 'merge' | 'split';

export type PdfWarning = 'PDF_PAGE_COUNT_PENDING' | 'PDF_THUMBNAIL_PENDING';

export type PdfAnalysisStatus = 'pending' | 'analyzing' | 'ready' | 'failed';

export interface PdfBookmark {
  id: string;
  title: string;
  destinationPageIndex?: number;
  children: PdfBookmark[];
}

export interface PdfPageInfo {
  pageIndex: number;
  widthPoints?: number;
  heightPoints?: number;
  rotation?: 0 | 90 | 180 | 270;
  thumbnailPath?: string;
}

export interface SelectedPdf {
  id: string;
  sourceUri: string;
  displayName: string;
  sizeBytes: number;
  nativePath?: string;
  pageCount?: number;
  thumbnailPath?: string;
  analysisStatus: PdfAnalysisStatus;
  warnings: PdfWarning[];
  analysis?: PdfAnalysis;
}

export type PdfBookmarkMode =
  | 'documents-and-bookmarks'
  | 'documents-only'
  | 'original-bookmarks';

export type PdfSplitMethod =
  | 'bookmarks'
  | 'manual-cut-points'
  | 'equal-number-of-parts'
  | 'maximum-file-size';

export interface PdfPageRange {
  fromPageIndex: number;
  toPageIndex: number;
}

export interface PdfSplitOutputPlan {
  id: string;
  title: string;
  ranges: PdfPageRange[];
  pageCount: number;
  bookSizeBytes?: number;
  coverSizeBytes?: number;
  estimatedSizeBytes?: number;
}

export interface PdfSession {
  id: string;
  operation: PdfOperation;
}

export interface PdfAnalysis {
  pageCount: number;
  bookmarks: PdfBookmark[];
  pages: PdfPageInfo[];
}

export interface PdfCoverDraft {
  source: 'none' | 'image' | 'editor';
  fileName?: string;
}

export interface MergePdfRequest {
  sessionId: string;
  pdfs: SelectedPdf[];
  bookmarkMode: PdfBookmarkMode;
  cover?: PdfCoverDraft;
  outputName: string;
  coverImageUri?: string;
  coverQuality?: number;
}

export interface SplitPdfRequest {
  sessionId: string;
  source: SelectedPdf;
  method: PdfSplitMethod;
  outputs: PdfSplitOutputPlan[];
  cover?: PdfCoverDraft;
  coverImageUri?: string;
  coverQuality?: number;
}

export interface PdfOperationResult {
  operationId: string;
  outputUris: string[];
  outputs?: Array<{
    uri: string;
    fileName: string;
    sizeBytes: number;
  }>;
  warnings?: string[];
}

export interface PdfRewriteService {
  createSession(operation: PdfOperation): Promise<PdfSession>;
  importPdf(sessionId: string, sourceUri: string, file: File): Promise<SelectedPdf>;
  analyzePdf(sessionId: string, pdfId: string): Promise<PdfAnalysis>;
  mergePdf(request: MergePdfRequest): Promise<PdfOperationResult>;
  splitPdf(request: SplitPdfRequest): Promise<PdfOperationResult>;
  cancelOperation?(): Promise<void>;
  cleanupSession(sessionId: string): Promise<void>;
}

export const PDF_ACCEPT = '.pdf,application/pdf';
export const MAX_PDF_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
