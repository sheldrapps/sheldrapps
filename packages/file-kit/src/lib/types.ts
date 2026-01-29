/**
 * Type definitions for file-kit
 */

/**
 * Directory option for file operations
 */
export type FileDirectory = 'Data' | 'Documents' | 'Cache';

/**
 * File reference descriptor
 */
export interface FileRef {
  /**
   * Full URI to the file (platform-specific)
   */
  uri: string;

  /**
   * MIME type
   */
  mimeType: string;

  /**
   * Filename (without path)
   */
  filename: string;

  /**
   * File size in bytes (optional)
   */
  size?: number;
}

/**
 * Parameters for write operation
 */
export interface WriteParams {
  /**
   * Directory to write to
   */
  dir: FileDirectory;

  /**
   * Relative path (e.g., 'Folder/file.txt')
   */
  path: string;

  /**
   * File bytes
   */
  bytes: Uint8Array;

  /**
   * MIME type
   */
  mimeType: string;
}

/**
 * Parameters for read operation
 */
export interface ReadParams {
  /**
   * Directory to read from
   */
  dir: FileDirectory;

  /**
   * Relative path
   */
  path: string;
}

/**
 * Parameters for delete operation
 */
export interface DeleteParams {
  /**
   * Directory
   */
  dir: FileDirectory;

  /**
   * Relative path
   */
  path: string;
}

/**
 * Parameters for exists check
 */
export interface ExistsParams {
  /**
   * Directory
   */
  dir: FileDirectory;

  /**
   * Relative path
   */
  path: string;
}

/**
 * Options for share operation
 */
export interface ShareOptions {
  /**
   * Title for share dialog
   */
  title?: string;

  /**
   * Text to share
   */
  text?: string;

  /**
   * Dialog title (Android)
   */
  dialogTitle?: string;
}
