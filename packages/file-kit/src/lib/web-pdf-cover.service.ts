import { Injectable, InjectionToken } from '@angular/core';

const PDF_MIME = 'application/pdf';
const COVER_MAX_DIMENSION = 1600;

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
  destroy?: () => Promise<void>;
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy?: () => Promise<void>;
};

type PdfJsPage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
  cleanup?: () => void;
};

type PdfJsLib = {
  getDocument: (src: {
    data: Uint8Array;
    disableWorker: boolean;
  }) => PdfJsLoadingTask;
  GlobalWorkerOptions?: {
    workerSrc: string;
  };
};

type PromiseWithResolvers<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export const WEB_PDF_COVER_SERVICE_TOKEN = new InjectionToken<WebPdfCoverService>(
  'WEB_PDF_COVER_SERVICE_TOKEN',
);

@Injectable({ providedIn: 'root' })
export class WebPdfCoverService {
  async isReadablePdf(file: File): Promise<boolean> {
    if (!file) return false;
    if (!/\.pdf$/i.test(file.name || '')) return false;
    if (file.size <= 0) return false;
    const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 8192)).arrayBuffer());
    const text = this.asAscii(bytes);
    if (!text.startsWith('%PDF-')) return false;
    return text.includes('%%EOF') || file.size > 1024;
  }

  async extractCover(_file: File): Promise<File | null> {
    if (!_file || _file.size <= 0) return null;

    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    let page: PdfJsPage | null = null;

    try {
      this.ensurePromiseWithResolversPolyfill();
      const bytes = new Uint8Array(await _file.arrayBuffer());
      const pdfjs = await this.loadPdfJs();

      loadingTask = pdfjs.getDocument({
        data: bytes,
        disableWorker: true,
      });
      pdfDocument = await loadingTask.promise;
      if (!pdfDocument || pdfDocument.numPages < 1) {
        return null;
      }

      page = await pdfDocument.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const longestSide = Math.max(baseViewport.width, baseViewport.height);
      const scale =
        longestSide > COVER_MAX_DIMENSION
          ? COVER_MAX_DIMENSION / longestSide
          : 1;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const blob = await this.canvasToPngBlob(canvas);
      if (!blob) {
        return null;
      }

      const fileName = this.deriveFirstPageName(_file.name || 'pdf');
      return new File([blob], fileName, { type: 'image/png' });
    } catch (error) {
      void error;
      return null;
    } finally {
      try {
        page?.cleanup?.();
      } catch {
        // best effort
      }
      try {
        await pdfDocument?.destroy?.();
      } catch {
        // best effort
      }
      try {
        await loadingTask?.destroy?.();
      } catch {
        // best effort
      }
    }
  }

  async createMinimalPdf(
    coverFile: File,
    _title = 'PDF Cover',
    _lang = 'en',
  ): Promise<Uint8Array> {
    const { jpgBytes, width, height } = await this.convertImageToJpeg(coverFile);
    return this.buildSinglePagePdfFromJpeg(jpgBytes, width, height);
  }

  async replaceCover(
    _sourcePdf: File,
    _coverFile: File,
    _filename?: string,
    _mode?: 'replace' | 'insert',
  ): Promise<Uint8Array> {
    throw new Error('WEB_PDF_REWRITE_UNSUPPORTED');
  }

  triggerDownload(bytes: Uint8Array, filename: string): void {
    const strict = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([strict], { type: PDF_MIME });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || 'document.pdf';
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private asAscii(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
      out += String.fromCharCode(bytes[i]);
    }
    return out;
  }

  private async loadPdfJs(): Promise<PdfJsLib> {
    const packageModule = await import('pdfjs-dist');
    const packageBuild = this.resolvePdfJsLib(packageModule);
    if (packageBuild) {
      this.configureWorker(packageBuild);
      return packageBuild;
    }

    throw new Error('PDFJS_LOAD_FAILED');
  }

  private resolvePdfJsLib(module: unknown): PdfJsLib | null {
    if (!module || typeof module !== 'object') {
      return null;
    }

    const direct = module as { getDocument?: unknown };
    if (typeof direct.getDocument === 'function') {
      return direct as unknown as PdfJsLib;
    }

    const nestedDefault = module as { default?: { getDocument?: unknown } };
    if (nestedDefault.default && typeof nestedDefault.default.getDocument === 'function') {
      return nestedDefault.default as unknown as PdfJsLib;
    }

    return null;
  }

  private configureWorker(pdfjs: PdfJsLib): void {
    const workerOptions = pdfjs.GlobalWorkerOptions;
    if (!workerOptions) return;
    if (typeof workerOptions.workerSrc === 'string' && workerOptions.workerSrc.trim()) {
      return;
    }

    const workerCandidates = [
      this.safeResolveWorkerUrl('pdfjs-dist/build/pdf.worker.min.mjs'),
      this.safeResolveWorkerUrl('pdfjs-dist/build/pdf.worker.mjs'),
    ].filter((value): value is string => !!value);

    if (workerCandidates.length > 0) {
      workerOptions.workerSrc = workerCandidates[0];
    }
  }

  private safeResolveWorkerUrl(specifier: string): string | null {
    try {
      return new URL(specifier, import.meta.url).toString();
    } catch {
      return null;
    }
  }

  private async canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/png'),
    );
    if (blob) return blob;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1] || '';
      const bytes = this.base64ToBytes(base64);
      const strict = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      return new Blob([strict], { type: 'image/png' });
    } catch {
      return null;
    }
  }

  private deriveFirstPageName(pdfName: string): string {
    const baseName = (pdfName || 'pdf')
      .replace(/\.pdf$/i, '')
      .replace(/[^\w.-]/g, '_');
    return `${baseName || 'pdf'}_page1.png`;
  }

  private ensurePromiseWithResolversPolyfill(): void {
    const promiseCtor = Promise as PromiseConstructor & {
      withResolvers?: <T>() => PromiseWithResolvers<T>;
    };
    if (typeof promiseCtor.withResolvers === 'function') {
      return;
    }

    promiseCtor.withResolvers = <T>() => {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  private async convertImageToJpeg(file: File): Promise<{
    jpgBytes: Uint8Array;
    width: number;
    height: number;
  }> {
    const dataUrl = await this.fileToDataUrl(file);
    const image = await this.loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.naturalWidth || image.width);
    canvas.height = Math.max(1, image.naturalHeight || image.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const jpgBytes = this.base64ToBytes(jpegDataUrl.split(',')[1] || '');
    return { jpgBytes, width: canvas.width, height: canvas.height };
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(reader.error || new Error('FILE_READ_FAILED'));
      reader.readAsDataURL(file);
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
      image.src = src;
    });
  }

  private base64ToBytes(data: string): Uint8Array {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private buildSinglePagePdfFromJpeg(
    jpgBytes: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const enc = new TextEncoder();
    const objects: Uint8Array[] = [];
    const offsets: number[] = [0];

    const push = (content: string | Uint8Array) => {
      objects.push(typeof content === 'string' ? enc.encode(content) : content);
    };

    push('%PDF-1.4\n');
    offsets.push(this.totalBytes(objects));
    push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    offsets.push(this.totalBytes(objects));
    push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    offsets.push(this.totalBytes(objects));
    push(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    );
    offsets.push(this.totalBytes(objects));
    push(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBytes.byteLength} >>\nstream\n`,
    );
    push(jpgBytes);
    push('\nendstream\nendobj\n');
    const contentStream = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
    const contentBytes = enc.encode(contentStream);
    offsets.push(this.totalBytes(objects));
    push(`5 0 obj\n<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    push(contentBytes);
    push('\nendstream\nendobj\n');

    const xrefOffset = this.totalBytes(objects);
    const count = 6;
    push(`xref\n0 ${count}\n`);
    push('0000000000 65535 f \n');
    for (let i = 1; i < count; i += 1) {
      const off = String(offsets[i] || 0).padStart(10, '0');
      push(`${off} 00000 n \n`);
    }
    push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return this.concat(objects);
  }

  private totalBytes(chunks: Uint8Array[]): number {
    return chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  }

  private concat(chunks: Uint8Array[]): Uint8Array {
    const total = this.totalBytes(chunks);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }
}
