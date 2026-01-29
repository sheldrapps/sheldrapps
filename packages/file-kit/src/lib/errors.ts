/**
 * File kit error handling
 */

export type FileKitErrorCode =
  | 'WRITE_FAILED'
  | 'READ_FAILED'
  | 'DELETE_FAILED'
  | 'SHARE_FAILED'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'UNKNOWN';

/**
 * Error thrown by file-kit operations
 */
export class FileKitError extends Error {
  constructor(
    public code: FileKitErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'FileKitError';
  }
}
