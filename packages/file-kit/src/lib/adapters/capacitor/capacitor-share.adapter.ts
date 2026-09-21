/**
 * Capacitor Share adapter
 */

import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { ShareAdapter } from '../share.adapter';
import { FileRef, ShareOptions } from '../../types';
import { FileKitError } from '../../errors';
import { reportFileShareFailure } from '../../file-telemetry';

export class CapacitorShareAdapter implements ShareAdapter {
  async share(ref: FileRef, options?: ShareOptions): Promise<boolean> {
    try {
      const { value: canShare } = await Share.canShare();
      if (!canShare) {
        return false;
      }

      const shareUri = await this.toShareableFileUri(ref);

      await Share.share({
        title: options?.title || ref.filename,
        ...(options?.text ? { text: options.text } : {}),
        files: [shareUri],
        dialogTitle: options?.dialogTitle || 'Share file',
      });

      return true;
    } catch (error) {
      if (String(error).includes('canceled')) {
        return false;
      }
      reportFileShareFailure({
        format: this.getFileFormat(ref),
        stage: this.getShareFailureStage(error),
      });
      console.error('[file-kit:share] failed', JSON.stringify({
        filename: ref.filename,
        uriScheme: this.getUriScheme(ref.uri),
        error: this.getErrorDetails(error),
      }));
      throw new FileKitError('SHARE_FAILED', 'Failed to share file', error);
    }
  }

  private async toShareableFileUri(ref: FileRef): Promise<string> {
    if (ref.uri.startsWith('file:')) {
      return ref.uri;
    }

    if (!ref.uri.startsWith('content:')) {
      if (ref.uri.startsWith('/')) {
        return `file://${ref.uri}`;
      }
      throw new Error(`Unsupported share URI: ${ref.uri}`);
    }

    // Capacitor Share on Android only accepts file:// URLs. Public documents
    // are intentionally exposed as content:// URIs, so copy them natively to
    // the app cache instead of reading the complete file into JavaScript.
    // The native copy avoids another large base64 allocation for EPUB/PDF files.
    await Filesystem.mkdir({
      path: 'file-kit-share',
      directory: Directory.Cache,
      recursive: true,
    });
    const cachePath = `file-kit-share/${Date.now()}-${this.toSafeCacheFilename(ref.filename)}`;
    await Filesystem.copy({
      from: ref.uri,
      to: cachePath,
      toDirectory: Directory.Cache,
    });

    const result = await Filesystem.getUri({
      path: cachePath,
      directory: Directory.Cache,
    });

    if (!result.uri.startsWith('file:')) {
      throw new Error(`Share cache did not resolve to a file URI: ${result.uri}`);
    }

    return result.uri;
  }

  private toSafeCacheFilename(filename: string): string {
    const safeFilename = filename
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^\.+/, '')
      .trim();
    return safeFilename || 'shared-file';
  }

  private getFileFormat(ref: FileRef): 'epub' | 'pdf' {
    return ref.mimeType === 'application/pdf' || ref.filename.toLowerCase().endsWith('.pdf')
      ? 'pdf'
      : 'epub';
  }

  private getShareFailureStage(error: unknown): string {
    const message = this.getErrorDetails(error).message ?? '';
    if (message.includes('Missing parent directory')) {
      return 'cache_directory';
    }
    if (message.includes('Unsupported share URI')) {
      return 'uri_validation';
    }
    if (message.includes('Share cache did not resolve')) {
      return 'cache_uri';
    }
    return 'share_dialog';
  }

  private getUriScheme(uri: string): string {
    return uri.split(':', 1)[0] || 'unknown';
  }

  private getErrorDetails(error: unknown): { name?: string; message?: string; code?: string | number } {
    if (!error || typeof error !== 'object') {
      return { message: String(error) };
    }
    const candidate = error as { name?: unknown; message?: unknown; code?: unknown };
    return {
      name: typeof candidate.name === 'string' ? candidate.name : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      code: typeof candidate.code === 'string' || typeof candidate.code === 'number'
        ? candidate.code
        : undefined,
    };
  }
}
