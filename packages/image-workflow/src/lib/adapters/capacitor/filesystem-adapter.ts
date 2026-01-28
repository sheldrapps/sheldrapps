/**
 * Capacitor Filesystem Adapter
 * Optional: for apps that want to use Capacitor file operations
 */

import { Filesystem, Directory } from '@capacitor/filesystem';
import type { IFileWriter, IFileReader } from '../../types';

export class CapacitorFileWriter implements IFileWriter {
  async write(
    path: string,
    data: Uint8Array | string,
    options?: { mimeType?: string; directory?: string }
  ): Promise<void> {
    const dataStr = typeof data === 'string' ? data : this.uint8ToBase64(data);

    await Filesystem.writeFile({
      path,
      data: dataStr,
      directory: (options?.directory as any) || Directory.Documents,
      recursive: true,
    });
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }
}

export class CapacitorFileReader implements IFileReader {
  async read(
    path: string,
    options?: { directory?: string }
  ): Promise<Uint8Array> {
    const res = await Filesystem.readFile({
      path,
      directory: (options?.directory as any) || Directory.Documents,
    });

    return this.base64ToUint8(typeof res.data === 'string' ? res.data : '');
  }

  private base64ToUint8(base64: string): Uint8Array {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
}
