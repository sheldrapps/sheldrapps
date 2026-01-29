/**
 * Share adapter interface
 */

import { FileRef, ShareOptions } from '../types';

export interface ShareAdapter {
  /**
   * Share a file using platform share dialog
   */
  share(ref: FileRef, options?: ShareOptions): Promise<boolean>;
}
