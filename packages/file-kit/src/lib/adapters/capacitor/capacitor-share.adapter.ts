/**
 * Capacitor Share adapter
 */

import { Share } from '@capacitor/share';
import { ShareAdapter } from '../share.adapter';
import { FileRef, ShareOptions } from '../../types';
import { FileKitError } from '../../errors';

export class CapacitorShareAdapter implements ShareAdapter {
  async share(ref: FileRef, options?: ShareOptions): Promise<boolean> {
    try {
      // Check if Share is available
      const { value: canShare } = await Share.canShare();
      if (!canShare) {
        console.warn('[file-kit] Share not available on this platform');
        return false;
      }

      await Share.share({
        title: options?.title || ref.filename,
        text: options?.text || `Sharing ${ref.filename}`,
        files: [ref.uri],
        dialogTitle: options?.dialogTitle || 'Share file',
      });

      return true;
    } catch (error) {
      console.warn('[file-kit] Share failed:', error);
      // Share being cancelled is not an error, just return false
      if (String(error).includes('canceled')) {
        return false;
      }
      throw new FileKitError('SHARE_FAILED', 'Failed to share file', error);
    }
  }
}
