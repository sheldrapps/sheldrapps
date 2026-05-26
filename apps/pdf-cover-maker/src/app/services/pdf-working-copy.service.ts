import { Injectable, inject } from '@angular/core';
import {
  Directory,
  Filesystem,
} from '@capacitor/filesystem';
import { FileKitService } from '@sheldrapps/file-kit/pdf';

export type PdfWorkingCopy = {
  workingPath: string;
  workingName: string;
  outputBaseName: string;
  workingFile: File;
  sourceMeta: {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  };
};

export type NativePdfWorkingCopy = {
  workingPath: string;
  workingName: string;
  workingNativePath: string;
  outputBaseName: string;
  sourceMeta: {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  };
};

export type NativeTempFile = {
  path: string;
  nativePath: string;
};

@Injectable({ providedIn: 'root' })
export class PdfWorkingCopyService {
  private readonly WORK_FOLDER = 'pdfcovermakerWork';
  private readonly DEFAULT_MIME_TYPE = 'application/pdf';
  private fileKit = inject(FileKitService);

  async startCycle(sourceFile: File): Promise<PdfWorkingCopy> {
    const base = this.sanitizeBaseName(sourceFile.name);
    const timestamp = this.formatTimestamp(new Date());
    const outputBaseName = `${base}-${timestamp}`;
    const workingName = await this.getUniqueWorkingName(outputBaseName);
    const workingPath = `${this.WORK_FOLDER}/${workingName}`;
    const bytes = new Uint8Array(await sourceFile.arrayBuffer());
    const mimeType = sourceFile.type || 'application/pdf';

    await this.fileKit.writeBytes({
      dir: 'Data',
      path: workingPath,
      bytes,
      mimeType,
    });

    const workingFile = new File([bytes], workingName, {
      type: mimeType,
      lastModified: sourceFile.lastModified || Date.now(),
    });

    return {
      workingPath,
      workingName,
      outputBaseName: workingName.replace(/\.pdf$/i, ''),
      workingFile,
      sourceMeta: {
        name: sourceFile.name || 'working.pdf',
        size: sourceFile.size,
        lastModified: sourceFile.lastModified || Date.now(),
        type: sourceFile.type || '',
      },
    };
  }

  async startStreamingCycle(
    sourceFile: File,
    onProgress?: (percent: number) => void,
  ): Promise<NativePdfWorkingCopy> {
    const base = this.sanitizeBaseName(sourceFile.name);
    const timestamp = this.formatTimestamp(new Date());
    const outputBaseName = `${base}-${timestamp}`;
    const workingName = await this.getUniqueWorkingName(outputBaseName);
    const workingPath = `${this.WORK_FOLDER}/${workingName}`;

    await this.writeFileToDataPath(sourceFile, workingPath, onProgress);

    return {
      workingPath,
      workingName,
      workingNativePath: await this.getNativeDataPath(workingPath),
      outputBaseName: workingName.replace(/\.pdf$/i, ''),
      sourceMeta: {
        name: sourceFile.name || 'working.pdf',
        size: sourceFile.size,
        lastModified: sourceFile.lastModified || Date.now(),
        type: sourceFile.type || '',
      },
    };
  }

  async writeTempCoverFile(
    coverFile: File,
    outputBaseName: string,
  ): Promise<NativeTempFile> {
    const ext = this.coverExtensionFromNameOrType(coverFile);
    const path = `${this.WORK_FOLDER}/${outputBaseName}_cover.${ext}`;
    await this.writeFileToDataPath(coverFile, path);
    return {
      path,
      nativePath: await this.getNativeDataPath(path),
    };
  }

  async buildOutputFile(outputBaseName: string): Promise<NativeTempFile> {
    const path = `${this.WORK_FOLDER}/${outputBaseName}_output.pdf`;
    return {
      path,
      nativePath: await this.getNativeDataPath(path),
    };
  }

  async cleanupWorkingCopy(path: string | null | undefined): Promise<void> {
    if (!path) return;
    try {
      await this.fileKit.delete({
        dir: 'Data',
        path,
      });
    } catch {
      // ignore missing file
    }
  }

  getWorkFolder(): string {
    return this.WORK_FOLDER;
  }

  private async writeFileToDataPath(
    file: File,
    path: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    try {
      onProgress?.(5);

      const bytes = new Uint8Array(await file.arrayBuffer());
      const mimeType = file.type || this.DEFAULT_MIME_TYPE;
      await this.fileKit.writeBytes({
        dir: 'Data',
        path,
        bytes,
        mimeType,
      });
      onProgress?.(100);
    } catch (error) {
      await this.cleanupWorkingCopy(path);
      throw error;
    }
  }

  private async getNativeDataPath(path: string): Promise<string> {
    const { uri } = await Filesystem.getUri({
      path,
      directory: Directory.Data,
    });

    return uri.startsWith('file://')
      ? decodeURIComponent(uri.replace(/^file:\/\//, ''))
      : uri;
  }

  private coverExtensionFromNameOrType(file: File): 'jpg' | 'png' | 'webp' {
    const byType = (file.type || '').toLowerCase();
    if (byType === 'image/png') return 'png';
    if (byType === 'image/webp') return 'webp';

    const byName = (file.name.split('.').pop() || '').toLowerCase();
    if (byName === 'png') return 'png';
    if (byName === 'webp') return 'webp';
    return 'jpg';
  }

  private sanitizeBaseName(name: string): string {
    const trimmed = (name || 'pdf').replace(/\.pdf$/i, '').trim();
    let safe = trimmed.replace(/[\/\\:*?"<>|]/g, ' ');
    safe = safe.replace(/[\x00-\x1f\x7f]/g, ' ');
    safe = safe.replace(/\s+/g, ' ').trim();
    if (!safe) safe = 'pdf';
    const maxLen = 80;
    if (safe.length > maxLen) safe = safe.slice(0, maxLen).trim();
    return safe || 'pdf';
  }

  private formatTimestamp(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
  }

  private async getUniqueWorkingName(base: string): Promise<string> {
    const ext = '.pdf';
    let candidate = `${base}${ext}`;
    let idx = 1;
    while (await this.fileKit.exists({ dir: 'Data', path: `${this.WORK_FOLDER}/${candidate}` })) {
      candidate = `${base} (${idx})${ext}`;
      idx += 1;
    }
    return candidate;
  }
}
