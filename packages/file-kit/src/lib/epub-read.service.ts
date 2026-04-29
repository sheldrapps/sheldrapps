import { Injectable, inject } from '@angular/core';
import { FileKitService } from './file-kit.service';
import { EpubRewriteService } from './epub-rewrite.service';

@Injectable({ providedIn: 'root' })
export class EpubReadService {
  private readonly TEMP_FOLDER = 'EpubReadTemp';
  private readonly COVER_EXTRACT_MAX_BYTES = 30 * 1024 * 1024;
  private readonly fileKit = inject(FileKitService);
  private readonly epubRewrite = inject(EpubRewriteService);

  validateEpub(file: File, maxSizeMB = 50): { valid: boolean; errorKey?: string } {
    return this.fileKit.validateEpub(file, maxSizeMB);
  }

  async validateEpubStructure(file: File): Promise<boolean> {
    if (!this.epubRewrite.isSupported()) {
      return true;
    }

    const tempPath = this.buildTempPath('validate', file.name || 'epub');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.fileKit.writeBytes({
        dir: 'Cache',
        path: tempPath,
        bytes,
        mimeType: 'application/epub+zip',
      });

      const uri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempPath,
      });
      const inspected = await this.epubRewrite.inspectEpub(uri);
      return inspected.success;
    } catch {
      return false;
    } finally {
      await this.cleanupTempPath(tempPath);
    }
  }

  async extractCoverFromEpubFile(
    file: File,
    maxBytes = this.COVER_EXTRACT_MAX_BYTES,
  ): Promise<File | null> {
    if (!this.epubRewrite.isSupported()) {
      return null;
    }

    const tempPath = this.buildTempPath('extract', file.name || 'epub');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.fileKit.writeBytes({
        dir: 'Cache',
        path: tempPath,
        bytes,
        mimeType: 'application/epub+zip',
      });

      const uri = await this.fileKit.getUri({
        dir: 'Cache',
        path: tempPath,
      });
      const extracted = await this.epubRewrite.extractCoverAssetFile({
        epubPath: uri,
        maxBytes,
        epubName: file.name || 'epub',
      });
      return extracted.file;
    } catch {
      return null;
    } finally {
      await this.cleanupTempPath(tempPath);
    }
  }

  private buildTempPath(prefix: string, filename: string): string {
    return `${this.TEMP_FOLDER}/${prefix}_${Date.now()}_${filename}`;
  }

  private async cleanupTempPath(path: string): Promise<void> {
    try {
      await this.fileKit.delete({ dir: 'Cache', path });
    } catch {
      // Best-effort cleanup.
    }
  }
}
