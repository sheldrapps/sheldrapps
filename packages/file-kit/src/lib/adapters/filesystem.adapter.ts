/**
 * Filesystem adapter interface
 */

import { FileDirectory, FileRef, ReadParams, WriteParams, DeleteParams, ExistsParams } from '../types';

export interface FilesystemAdapter {
  /**
   * Write bytes to file
   */
  writeBytes(params: WriteParams): Promise<FileRef>;

  /**
   * Read bytes from file
   */
  readBytes(params: ReadParams): Promise<Uint8Array>;

  /**
   * Delete a file
   */
  delete(params: DeleteParams): Promise<void>;

  /**
   * Check if file exists
   */
  exists(params: ExistsParams): Promise<boolean>;

  /**
   * Get URI for an existing file
   */
  getUri(params: ExistsParams): Promise<string>;
}
