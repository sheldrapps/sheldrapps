import { Injectable, inject } from '@angular/core';
import {
  AppendFileOptions,
  Directory,
  Filesystem,
} from '@capacitor/filesystem';
import { FileKitService } from '@sheldrapps/file-kit';

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
  private readonly WORK_FOLDER = 'EPUBCoverChangerWork';
  private fileKit = inject(FileKitService);

  async startCycle(sourceFile: File): Promise<EpubWorkingCopy> {
    const base = this.sanitizeBaseName(sourceFile.name);
    const timestamp = this.formatTimestamp(new Date());
    const outputBaseName = `${base}_${timestamp}`;
    const workingName = await this.getUniqueWorkingName(outputBaseName);
    const workingPath = `${this.WORK_FOLDER}/${workingName}`;
    const bytes = new Uint8Array(await sourceFile.arrayBuffer());
    const mimeType = sourceFile.type || 'application/epub+zip';

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

    await this.streamFileToDataPath(sourceFile, workingPath, onProgress);

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
    await this.streamFileToDataPath(coverFile, path);
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
      // ignore missing file
    }
  }

  getWorkFolder(): string {
    return this.WORK_FOLDER;
  }

  private async streamFileToDataPath(
    file: File,
    path: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    const stream = file.stream();
    const reader = stream.getReader();

    try {
      await Filesystem.writeFile({
        path,
        directory: Directory.Data,
        data: '',
        recursive: true,
      });

      const total = Math.max(1, file.size || 1);
      let written = 0;
      let lastPercent = -1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;

        await Filesystem.appendFile({
          path,
          directory: Directory.Data,
          data: this.fileKit.toBase64(value),
        } satisfies AppendFileOptions);

        written += value.byteLength;
        const percent = Math.max(
          0,
          Math.min(100, Math.round((written / total) * 100)),
        );
        if (percent !== lastPercent) {
          onProgress?.(percent);
          lastPercent = percent;
        }
      }
    } catch (error) {
      await this.cleanupWorkingCopy(path);
      throw error;
    } finally {
      reader.releaseLock();
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

  private formatTimestamp(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
  }

  private async getUniqueWorkingName(base: string): Promise<string> {
    const ext = '.epub';
    let candidate = `${base}${ext}`;
    let idx = 1;
    while (await this.fileKit.exists({ dir: 'Data', path: `${this.WORK_FOLDER}/${candidate}` })) {
      candidate = `${base} (${idx})${ext}`;
      idx += 1;
    }
    return candidate;
  }
}
