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

@Injectable({ providedIn: "root" })
export class FileKitService {
  constructor(
    @Inject(FILESYSTEM_ADAPTER_TOKEN)
    private filesystemAdapter: FilesystemAdapter,
    @Inject(SHARE_ADAPTER_TOKEN)
    private shareAdapter: ShareAdapter,
  ) {
    console.log("[file-kit] FileKitService initialized");
  }

  /**
   * Write bytes to a file
   */
  async writeBytes(params: WriteParams): Promise<FileRef> {
    if (!params.path || !params.bytes) {
      throw new FileKitError("INVALID_INPUT", "path and bytes are required");
    }
    return this.filesystemAdapter.writeBytes(params);
  }

  /**
   * Read bytes from a file
   */
  async readBytes(params: ReadParams): Promise<Uint8Array> {
    if (!params.path) {
      throw new FileKitError("INVALID_INPUT", "path is required");
    }
    return this.filesystemAdapter.readBytes(params);
  }

  /**
   * Delete a file
   */
  async delete(params: DeleteParams): Promise<void> {
    if (!params.path) {
      throw new FileKitError("INVALID_INPUT", "path is required");
    }
    return this.filesystemAdapter.delete(params);
  }

  /**
   * Check if file exists
   */
  async exists(params: ExistsParams): Promise<boolean> {
    if (!params.path) {
      throw new FileKitError("INVALID_INPUT", "path is required");
    }
    return this.filesystemAdapter.exists(params);
  }

  /**
   * Convert Uint8Array to base64 string
   */
  toBase64(bytes: Uint8Array): string {
    let binary = "";
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
        "INVALID_INPUT",
        "FileRef must have uri and filename",
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
      throw new FileKitError("INVALID_INPUT", "path is required");
    }
    return this.filesystemAdapter.getUri(params);
  }

  /**
   * Validate if a file is a valid EPUB
   * Checks file extension and MIME type
   */
  isValidEpub(file: File): boolean {
    if (!file) return false;

    // Check file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = fileName.endsWith(".epub");

    // Check MIME type (EPUB files can have different MIME types)
    const validMimeTypes = [
      "application/epub+zip",
      "application/epub",
      "application/x-epub",
      "application/octet-stream", // Sometimes EPUBs are detected as octet-stream
      "application/zip", // EPUBs are ZIP archives
    ];
    const hasValidMimeType = validMimeTypes.includes(file.type);

    // File must have .epub extension and a compatible MIME type
    return hasValidExtension && (hasValidMimeType || file.type === "");
  }

  /**
   * Validate EPUB file with size limit
   * @param file File to validate
   * @param maxSizeMB Maximum size in MB (default: 50MB)
   * @returns Validation result with error key if invalid
   */
  validateEpub(
    file: File,
    maxSizeMB: number = 50,
  ): { valid: boolean; errorKey?: string } {
    if (!file) {
      return { valid: false, errorKey: "EPUB_ERROR_NO_FILE" };
    }

    // Check if it's a valid EPUB by extension and MIME
    if (!this.isValidEpub(file)) {
      return { valid: false, errorKey: "EPUB_ERROR_TYPE" };
    }

    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return { valid: false, errorKey: "EPUB_ERROR_SIZE" };
    }

    // Check if file has content
    if (file.size === 0) {
      return { valid: false, errorKey: "EPUB_ERROR_CORRUPT" };
    }

    return { valid: true };
  }
}
