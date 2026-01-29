/**
 * Capacitor Filesystem adapter
 */

import {
  Filesystem,
  Directory,
  GetUriResult,
} from '@capacitor/filesystem';
import { FilesystemAdapter } from '../filesystem.adapter';
import {
  FileDirectory,
  FileRef,
  ReadParams,
  WriteParams,
  DeleteParams,
  ExistsParams,
} from '../../types';
import { FileKitError } from '../../errors';

/**
 * Map FileDirectory to Capacitor Directory
 */
function mapDirectory(dir: FileDirectory): Directory {
  switch (dir) {
    case 'Data':
      return Directory.Data;
    case 'Documents':
      return Directory.Documents;
    case 'Cache':
      return Directory.Cache;
    default:
      return Directory.Documents;
  }
}

/**
 * Convert base64 to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Extract filename from path
 */
function getFilenameFromPath(path: string): string {
  return path.split('/').pop() || 'file';
}

export class CapacitorFilesystemAdapter implements FilesystemAdapter {
  async writeBytes(params: WriteParams): Promise<FileRef> {
    try {
      const directory = mapDirectory(params.dir);
      const base64 = uint8ArrayToBase64(params.bytes);

      // Ensure parent directories exist by using recursive: true
      await Filesystem.writeFile({
        path: params.path,
        data: base64,
        directory,
        recursive: true,
      });

      // Get URI
      let uri: string;
      try {
        const result: GetUriResult = await Filesystem.getUri({
          path: params.path,
          directory,
        });
        uri = result.uri;
      } catch (e) {
        console.warn('[file-kit] Could not get URI:', e);
        uri = `file://${params.path}`;
      }

      const filename = getFilenameFromPath(params.path);

      return {
        uri,
        mimeType: params.mimeType,
        filename,
        size: params.bytes.length,
      };
    } catch (error) {
      console.warn('[file-kit] Write failed:', error);
      throw new FileKitError(
        'WRITE_FAILED',
        `Failed to write file: ${params.path}`,
        error
      );
    }
  }

  async readBytes(params: ReadParams): Promise<Uint8Array> {
    try {
      const directory = mapDirectory(params.dir);

      const result = await Filesystem.readFile({
        path: params.path,
        directory,
      });

      // Handle different data formats
      if (typeof result.data === 'string') {
        // base64 encoded
        return base64ToUint8Array(result.data);
      } else if (result.data instanceof Uint8Array) {
        return result.data;
      } else {
        throw new Error('Unexpected data format');
      }
    } catch (error) {
      console.warn('[file-kit] Read failed:', error);
      const code = String(error).includes('ENOENT') ? 'NOT_FOUND' : 'READ_FAILED';
      throw new FileKitError(code, `Failed to read file: ${params.path}`, error);
    }
  }

  async delete(params: DeleteParams): Promise<void> {
    try {
      const directory = mapDirectory(params.dir);
      await Filesystem.deleteFile({
        path: params.path,
        directory,
      });
    } catch (error) {
      console.warn('[file-kit] Delete failed:', error);
      throw new FileKitError(
        'DELETE_FAILED',
        `Failed to delete file: ${params.path}`,
        error
      );
    }
  }

  async exists(params: ExistsParams): Promise<boolean> {
    try {
      const directory = mapDirectory(params.dir);
      await Filesystem.stat({
        path: params.path,
        directory,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getUri(params: ExistsParams): Promise<string> {
    try {
      const directory = mapDirectory(params.dir);
      const result: GetUriResult = await Filesystem.getUri({
        path: params.path,
        directory,
      });
      return result.uri;
    } catch (error) {
      console.warn('[file-kit] Get URI failed:', error);
      throw new FileKitError(
        'READ_FAILED',
        `Failed to get URI for file: ${params.path}`,
        error
      );
    }
  }
}
