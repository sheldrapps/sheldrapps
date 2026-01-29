/**
 * File Kit Service
 * Main service for file operations
 */

import { Injectable, Inject } from '@angular/core';
import {
  FileDirectory,
  FileRef,
  WriteParams,
  ReadParams,
  DeleteParams,
  ExistsParams,
  ShareOptions,
} from './types';
import { FileKitError } from './errors';
import { guessMimeType } from './mime';
import { makeSafeFilename } from './name';
import { FilesystemAdapter } from './adapters/filesystem.adapter';
import { ShareAdapter } from './adapters/share.adapter';
import {
  FILESYSTEM_ADAPTER_TOKEN,
  SHARE_ADAPTER_TOKEN,
} from './providers';

@Injectable({ providedIn: 'root' })
export class FileKitService {
  constructor(
    @Inject(FILESYSTEM_ADAPTER_TOKEN)
    private filesystemAdapter: FilesystemAdapter,
    @Inject(SHARE_ADAPTER_TOKEN)
    private shareAdapter: ShareAdapter
  ) {
    console.log('[file-kit] FileKitService initialized');
  }

  /**
   * Write bytes to a file
   */
  async writeBytes(params: WriteParams): Promise<FileRef> {
    if (!params.path || !params.bytes) {
      throw new FileKitError(
        'INVALID_INPUT',
        'path and bytes are required'
      );
    }
    return this.filesystemAdapter.writeBytes(params);
  }

  /**
   * Read bytes from a file
   */
  async readBytes(params: ReadParams): Promise<Uint8Array> {
    if (!params.path) {
      throw new FileKitError('INVALID_INPUT', 'path is required');
    }
    return this.filesystemAdapter.readBytes(params);
  }

  /**
   * Delete a file
   */
  async delete(params: DeleteParams): Promise<void> {
    if (!params.path) {
      throw new FileKitError('INVALID_INPUT', 'path is required');
    }
    return this.filesystemAdapter.delete(params);
  }

  /**
   * Check if file exists
   */
  async exists(params: ExistsParams): Promise<boolean> {
    if (!params.path) {
      throw new FileKitError('INVALID_INPUT', 'path is required');
    }
    return this.filesystemAdapter.exists(params);
  }

  /**
   * Convert Uint8Array to base64 string
   */
  toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to Uint8Array
   */
  fromBase64(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Share a file using platform share dialog
   */
  async share(ref: FileRef, options?: ShareOptions): Promise<boolean> {
    if (!ref.uri || !ref.filename) {
      throw new FileKitError(
        'INVALID_INPUT',
        'FileRef must have uri and filename'
      );
    }
    return this.shareAdapter.share(ref, options);
  }

  /**
   * Generate a safe filename
   */
  makeSafeFilename(name: string, ext?: string): string {
    return makeSafeFilename(name, ext);
  }

  /**
   * Guess MIME type from filename or extension
   */
  guessMimeType(filenameOrExt: string): string {
    return guessMimeType(filenameOrExt);
  }

  /**
   * Get URI for an existing file
   */
  async getUri(params: ExistsParams): Promise<string> {
    if (!params.path) {
      throw new FileKitError('INVALID_INPUT', 'path is required');
    }
    return this.filesystemAdapter.getUri(params);
  }
}
