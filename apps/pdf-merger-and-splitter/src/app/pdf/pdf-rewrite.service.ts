import { Injectable } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Capacitor, registerPlugin, type Plugin, type PluginListenerHandle } from '@capacitor/core';
import { PDFDocument } from 'pdf-lib';
import {
  MAX_PDF_SIZE_BYTES,
  type MergePdfRequest,
  type PdfAnalysis,
  type PdfOperation,
  type PdfOperationResult,
  type PdfRewriteService,
  type PdfSession,
  type SelectedPdf,
  type SplitPdfRequest,
} from './pdf-domain';

type NativeResult = { success: boolean; error?: string; message?: string; stage?: string };
type NativePdfPlugin = Plugin & {
  createSession(options: { operation: PdfOperation }): Promise<NativeResult & { sessionId?: string }>;
  pickAndPreparePdf(options: { maxBytes: number }): Promise<NativeResult & {
    selectedName?: string;
    sourceSize?: number;
    workingNativePath?: string;
  }>;
  importPdf(options: { sessionId: string; sourceUri: string; maxBytes: number }): Promise<NativeResult & { pdfId?: string; displayName?: string; sizeBytes?: number; nativePath?: string }>;
  analyzePdf(options: { sessionId: string; pdfId: string }): Promise<NativeResult & PdfAnalysis>;
  mergePdf(options: { sessionId: string; pdfIds: string[]; displayNames: string[]; bookmarkMode: string; outputName: string; coverImageUri?: string; coverQuality?: number }): Promise<NativeResult & PdfOperationResult>;
  splitPdf(options: { sessionId: string; pdfId: string; outputs: unknown[]; coverImageUri?: string; coverQuality?: number }): Promise<NativeResult & PdfOperationResult>;
  cancelOperation(): Promise<NativeResult>;
  cleanupSession(options: { sessionId: string }): Promise<NativeResult>;
};

const PdfRewrite = registerPlugin<NativePdfPlugin>('PdfRewritePlugin');

export class PdfRewriteError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = 'PdfRewriteError';
  }
}

@Injectable({ providedIn: 'root' })
export class PdfRewriteNativeService implements PdfRewriteService {
  private readonly NATIVE_COPY_CHUNK_BYTES = 256 * 1024;
  private readonly WEB_MAX_PDF_BYTES = 128 * 1024 * 1024;
  private readonly webSessions = new Map<string, { operation: PdfOperation; files: Map<string, File> }>();

  async createSession(operation: PdfOperation): Promise<PdfSession> {
    if (Capacitor.getPlatform() === 'web') {
      const id = this.createWebId();
      this.webSessions.set(id, { operation, files: new Map() });
      return { id, operation };
    }
    const result = await PdfRewrite.createSession({ operation });
    if (!result.success || !result.sessionId) this.throwResult(result);
    return { id: result.sessionId, operation };
  }

  async importPdf(sessionId: string, sourceUri: string, file: File): Promise<SelectedPdf> {
    if (!file || file.size <= 0) throw new PdfRewriteError('EMPTY_PDF');
    if (file.size > MAX_PDF_SIZE_BYTES) throw new PdfRewriteError('PDF_TOO_LARGE');
    if (Capacitor.getPlatform() === 'web') return this.importWebPdf(sessionId, sourceUri, file);
    if (!/^(content|file):/i.test(sourceUri)) {
      throw new PdfRewriteError('NATIVE_PICK_REQUIRED');
    }
    return this.importNativePdf(sessionId, sourceUri);
  }

  isNativeSupported(): boolean {
    return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('PdfRewritePlugin');
  }

  async pickAndImportPdf(sessionId: string): Promise<SelectedPdf> {
    if (!this.isNativeSupported()) {
      throw new PdfRewriteError('NATIVE_PICK_REQUIRED');
    }
    const prepared = await PdfRewrite.pickAndPreparePdf({ maxBytes: MAX_PDF_SIZE_BYTES });
    if (!prepared.success || !prepared.workingNativePath) {
      this.throwResult(prepared);
    }
    const imported = await this.importNativePdf(sessionId, prepared.workingNativePath);
    return {
      ...imported,
      displayName: prepared.selectedName || imported.displayName,
    };
  }

  async analyzePdf(sessionId: string, pdfId: string): Promise<PdfAnalysis> {
    if (Capacitor.getPlatform() === 'web') {
      const file = this.webSessions.get(sessionId)?.files.get(pdfId);
      if (!file) throw new PdfRewriteError('SOURCE_FILE_NOT_FOUND');
      const pageCount = await this.readWebPageCount(file);
      return {
        pageCount,
        pages: Array.from({ length: pageCount }, (_, pageIndex) => ({ pageIndex })),
        bookmarks: [],
      };
    }
    const result = await PdfRewrite.analyzePdf({ sessionId, pdfId });
    if (!result.success) this.throwResult(result);
    return { pageCount: result.pageCount, pages: result.pages ?? [], bookmarks: result.bookmarks ?? [] };
  }

  async mergePdf(request: MergePdfRequest): Promise<PdfOperationResult> {
    if (Capacitor.getPlatform() === 'web') {
      return this.mergeWebPdfs(request);
    }
    const result = await PdfRewrite.mergePdf({ sessionId: request.sessionId, pdfIds: request.pdfs.map((pdf) => pdf.id), displayNames: request.pdfs.map((pdf) => pdf.displayName), bookmarkMode: request.bookmarkMode, outputName: request.outputName, coverImageUri: request.coverImageUri, coverQuality: request.coverQuality });
    if (!result.success) this.throwResult(result);
    return result;
  }

  async splitPdf(request: SplitPdfRequest): Promise<PdfOperationResult> {
    if (Capacitor.getPlatform() === 'web') {
      return this.splitWebPdf(request);
    }
    const result = await PdfRewrite.splitPdf({ sessionId: request.sessionId, pdfId: request.source.id, outputs: request.outputs, coverImageUri: request.coverImageUri, coverQuality: request.coverQuality });
    if (!result.success) this.throwResult(result);
    return result;
  }

  async cancelOperation(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') return;
    const result = await PdfRewrite.cancelOperation();
    if (!result.success) this.throwResult(result);
  }
  async stageCoverImage(file: File): Promise<string> { return this.privateUri(file, URL.createObjectURL(file)); }
  async cleanupSession(sessionId: string): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      this.webSessions.delete(sessionId);
      return;
    }
    const result = await PdfRewrite.cleanupSession({ sessionId });
    if (!result.success) this.throwResult(result);
  }
  addProgressListener(listener: (event: { phase: string; percent: number; completed: number; total: number }) => void): Promise<PluginListenerHandle> {
    if (Capacitor.getPlatform() === 'web') return Promise.resolve({ remove: async () => undefined } as PluginListenerHandle);
    return PdfRewrite.addListener('pdfOperationProgress', listener);
  }

  private async importWebPdf(sessionId: string, sourceUri: string, file: File): Promise<SelectedPdf> {
    const session = this.webSessions.get(sessionId);
    if (!session) throw new PdfRewriteError('SESSION_NOT_FOUND');
    this.ensureWebSize(file);
    if (!(await this.isReadableWebPdf(file))) throw new PdfRewriteError('PDF_CORRUPT');
    const id = this.createWebId();
    session.files.set(id, file);
    const pageCount = await this.readWebPageCount(file);
    return {
      id,
      sourceUri,
      displayName: file.name || 'document.pdf',
      sizeBytes: file.size,
      pageCount,
      analysis: {
        pageCount,
        pages: Array.from({ length: pageCount }, (_, pageIndex) => ({ pageIndex })),
        bookmarks: [],
      },
      analysisStatus: 'ready',
      warnings: [],
    };
  }

  private async importNativePdf(sessionId: string, sourceUri: string): Promise<SelectedPdf> {
    const result = await PdfRewrite.importPdf({
      sessionId,
      sourceUri,
      maxBytes: MAX_PDF_SIZE_BYTES,
    });
    if (!result.success || !result.pdfId || !result.displayName || typeof result.sizeBytes !== 'number') {
      this.throwResult(result);
    }
    const analysis = await this.analyzePdf(sessionId, result.pdfId);
    return {
      id: result.pdfId,
      sourceUri,
      nativePath: result.nativePath,
      displayName: result.displayName,
      sizeBytes: result.sizeBytes,
      pageCount: analysis.pageCount,
      analysis,
      analysisStatus: 'ready',
      warnings: [],
    };
  }

  private async mergeWebPdfs(request: MergePdfRequest): Promise<PdfOperationResult> {
    const session = this.webSessions.get(request.sessionId);
    if (!session) throw new PdfRewriteError('SESSION_NOT_FOUND');
    const sourceDocuments = request.pdfs.map((pdf) => {
      const file = session.files.get(pdf.id);
      if (!file) throw new PdfRewriteError('SOURCE_FILE_NOT_FOUND');
      this.ensureWebSize(file);
      return file;
    });
    const output = await PDFDocument.create();
    await this.addWebCover(output, request.coverImageUri);
    for (const file of sourceDocuments) {
      const source = await PDFDocument.load(await file.arrayBuffer());
      const pages = await output.copyPages(source, source.getPageIndices());
      pages.forEach((page) => output.addPage(page));
    }
    return this.webResult(await output.save(), this.normalizeWebName(request.outputName || 'merged-document.pdf'));
  }

  private async splitWebPdf(request: SplitPdfRequest): Promise<PdfOperationResult> {
    const session = this.webSessions.get(request.sessionId);
    const file = session?.files.get(request.source.id);
    if (!file) throw new PdfRewriteError('SOURCE_FILE_NOT_FOUND');
    this.ensureWebSize(file);
    const source = await PDFDocument.load(await file.arrayBuffer());
    const outputs = [] as NonNullable<PdfOperationResult['outputs']>;
    for (const [index, plan] of request.outputs.entries()) {
      const output = await PDFDocument.create();
      await this.addWebCover(output, request.coverImageUri);
      const pageIndices = plan.ranges.flatMap((range) => {
        const pages: number[] = [];
        for (let page = range.fromPageIndex; page <= range.toPageIndex; page += 1) pages.push(page);
        return pages;
      });
      const pages = await output.copyPages(source, pageIndices);
      pages.forEach((page) => output.addPage(page));
      const bytes = await output.save();
      outputs.push(this.webOutput(bytes, this.normalizeWebName(plan.title || `part-${index + 1}.pdf`)));
    }
    return { operationId: this.createWebId(), outputUris: outputs.map((output) => output.uri), outputs, warnings: [] };
  }

  private async addWebCover(output: PDFDocument, coverUri?: string): Promise<void> {
    if (!coverUri) return;
    const response = await fetch(coverUri);
    const blob = await response.blob();
    if (blob.size > 32 * 1024 * 1024) throw new PdfRewriteError('COVER_TOO_LARGE');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const image = bytes[0] === 0x89 ? await output.embedPng(bytes) : await output.embedJpg(bytes);
    const page = output.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  private webResult(bytes: Uint8Array, fileName: string): PdfOperationResult {
    const output = this.webOutput(bytes, fileName);
    return { operationId: this.createWebId(), outputUris: [output.uri], outputs: [output], warnings: [] };
  }

  private webOutput(bytes: Uint8Array, fileName: string): { uri: string; fileName: string; sizeBytes: number } {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return {
      uri: URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' })),
      fileName,
      sizeBytes: bytes.byteLength,
    };
  }

  private normalizeWebName(name: string): string {
    const normalized = name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'document.pdf';
    return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized}.pdf`;
  }

  private async readWebPageCount(file: File): Promise<number> {
    this.ensureWebSize(file);
    const bytes = new TextDecoder('latin1').decode(new Uint8Array(await file.arrayBuffer()));
    return Math.max(1, (bytes.match(/\/Type\s*\/Page\b/g) ?? []).length);
  }

  private ensureWebSize(file: File): void {
    if (file.size > this.WEB_MAX_PDF_BYTES) throw new PdfRewriteError('PDF_TOO_LARGE');
  }

  private async isReadableWebPdf(file: File): Promise<boolean> {
    const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 8192)).arrayBuffer());
    let header = '';
    for (const byte of bytes) header += String.fromCharCode(byte);
    return header.startsWith('%PDF-') && (header.includes('%%EOF') || file.size > 1024);
  }

  private createWebId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private async privateUri(file: File, fallback: string): Promise<string> {
    if (Capacitor.getPlatform() === 'web') return fallback;
    const path = `PdfMergerAndSplitter/${crypto.randomUUID()}-${file.name}`;
    let offset = 0;
    let firstChunk = true;
    while (offset < file.size) {
      const end = Math.min(file.size, offset + this.NATIVE_COPY_CHUNK_BYTES);
      const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      const data = this.toBase64(bytes);
      if (firstChunk) {
        await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
        firstChunk = false;
      } else {
        await Filesystem.appendFile({ path, data, directory: Directory.Cache });
      }
      offset = end;
    }
    if (firstChunk) await Filesystem.writeFile({ path, data: '', directory: Directory.Cache, recursive: true });
    return (await Filesystem.getUri({ path, directory: Directory.Cache })).uri;
  }
  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
    }
    return btoa(binary);
  }
  private throwResult(result: NativeResult): never { throw new PdfRewriteError(result.error ?? 'REWRITE_FAILED', result.message); }
}
