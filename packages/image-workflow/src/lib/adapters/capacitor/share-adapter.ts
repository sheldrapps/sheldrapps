/**
 * Capacitor Share Adapter
 */

import { Share } from '@capacitor/share';
import type { IFileSharer } from '../../types';

export class CapacitorFileSharer implements IFileSharer {
  async share(options: {
    title?: string;
    text?: string;
    files: string[];
  }): Promise<void> {
    await Share.share({
      title: options.title,
      text: options.text,
      files: options.files,
      dialogTitle: options.title,
    });
  }
}
