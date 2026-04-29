import { Injectable, inject } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileKitService } from './file-kit.service';

export type EpubWorkingCopy = {
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

export type NativeEpubWorkingCopy = {
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
export class EpubWorkingCopyService {
  private readonly WORK_FOLDER = 'EpubWork';
  private readonly DEFAULT_MIME_TYPE = 'application/epub+zip';
  private readonly fileKit = inject(FileKitService);

  async startCycle(sourceFile: File): Promise<EpubWorkingCopy> {
    const base = this.sanitizeBaseName(sourceFile.name);
    const timestamp = this.formatTimestamp(new Date());
    const outputBaseName = `${base}_${timestamp}`;
    const workingName = await this.getUniqueWorkingName(outputBaseName);
    const workingPath = `${this.WORK_FOLDER}/${workingName}`;
    const bytes = new Uint8Array(await sourceFile.arrayBuffer());
    const mimeType = sourceFile.type || this.DEFAULT_MIME_TYPE;

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
      outputBaseName: workingName.replace(/\.epub$/i, ''),
      workingFile,
      sourceMeta: {
        name: sourceFile.name || 'working.epub',
        size: sourceFile.size,
        lastModified: sourceFile.lastModified || Date.now(),
        type: sourceFile.type || '',
      },
    };
  }

  async startStreamingCycle(
    sourceFile: File,
    onProgress?: (percent: number) => void,
  ): Promise<NativeEpubWorkingCopy> {
    const base = this.sanitizeBaseName(sourceFile.name);
    const timestamp = this.formatTimestamp(new Date());
    const outputBaseName = `${base}_${timestamp}`;
    const workingName = await this.getUniqueWorkingName(outputBaseName);
    const workingPath = `${this.WORK_FOLDER}/${workingName}`;

    await this.writeFileToDataPath(sourceFile, workingPath, onProgress);

    return {
      workingPath,
      workingName,
      workingNativePath: await this.getNativeDataPath(workingPath),
      outputBaseName: workingName.replace(/\.epub$/i, ''),
      sourceMeta: {
        name: sourceFile.name || 'working.epub',
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
    const path = `${this.WORK_FOLDER}/${outputBaseName}_output.epub`;
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
      // Best-effort cleanup.
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
    const trimmed = (name || 'epub').replace(/\.epub$/i, '').trim();
    let safe = trimmed.replace(/[\/\\:*?"<>|]/g, ' ');
    safe = safe.replace(/[\x00-\x1f\x7f]/g, ' ');
    safe = safe.replace(/\s+/g, ' ').trim();
    if (!safe) safe = 'epub';
    const maxLen = 80;
    if (safe.length > maxLen) safe = safe.slice(0, maxLen).trim();
    return safe || 'epub';
  }

  private formatTimestamp(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
  }

  private async getUniqueWorkingName(base: string): Promise<string> {
    const ext = '.epub';
    let candidate = `${base}${ext}`;
    let index = 1;
    while (
      await this.fileKit.exists({
        dir: 'Data',
        path: `${this.WORK_FOLDER}/${candidate}`,
      })
    ) {
      candidate = `${base} (${index})${ext}`;
      index += 1;
    }
    return candidate;
  }
}
