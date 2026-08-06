/**
 * Capacitor Share adapter
 */

import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { ShareAdapter } from '../share.adapter';
import { FileRef, ShareOptions } from '../../types';
import { FileKitError } from '../../errors';

export class CapacitorShareAdapter implements ShareAdapter {
  async share(ref: FileRef, options?: ShareOptions): Promise<boolean> {
    try {
      // Check if Share is available
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
      // Share being cancelled is not an error, just return false
      if (String(error).includes('canceled')) {
        return false;
      }
      throw new FileKitError('SHARE_FAILED', 'Failed to share file', error);
    }
  }

  private async toShareableFileUri(ref: FileRef): Promise<string> {
    if (!ref.uri.startsWith('content:')) {
      return ref.uri;
    }

    const cachePath = `file-kit-share/${this.toSafeCacheFilename(ref.filename)}`;
    const source = await Filesystem.readFile({ path: ref.uri });

    if (typeof source.data !== 'string') {
      throw new Error('Native content URI did not return base64 data');
    }

    await Filesystem.writeFile({
      path: cachePath,
      data: source.data,
      directory: Directory.Cache,
      recursive: true,
    });

    const result = await Filesystem.getUri({
      path: cachePath,
      directory: Directory.Cache,
    });
    return result.uri;
  }

  private toSafeCacheFilename(filename: string): string {
    const safeFilename = filename
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^\.+/, '')
      .trim();
    return safeFilename || 'shared-file';
  }
}
