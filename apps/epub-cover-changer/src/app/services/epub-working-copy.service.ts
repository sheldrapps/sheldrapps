import { Injectable, inject } from '@angular/core';
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
