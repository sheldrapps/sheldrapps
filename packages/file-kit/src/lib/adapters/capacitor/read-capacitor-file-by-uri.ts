import { Capacitor } from '@capacitor/core';
import type { Directory } from '@capacitor/filesystem';
import type { PublicFilesystem } from '../../public-filesystem';

type ReadOptions = { path: string; directory?: Directory };

export const MAX_NATIVE_JS_READ_BYTES = 32 * 1024 * 1024;

export class CapacitorFileReadLimitError extends Error {
  constructor(
    readonly sizeBytes: number,
    readonly maxBytes: number,
  ) {
    super(`FILE_TOO_LARGE: ${sizeBytes} bytes exceeds ${maxBytes} bytes`);
    this.name = 'CapacitorFileReadLimitError';
  }
}

export async function readCapacitorFileByUri(
  filesystem: Pick<PublicFilesystem, 'getUri' | 'stat'>,
  options: ReadOptions,
  maxBytes = MAX_NATIVE_JS_READ_BYTES,
): Promise<Uint8Array> {
  const stat = await filesystem.stat(
    options as Parameters<PublicFilesystem['stat']>[0],
  );
  if (
    typeof stat.size === 'number' &&
    Number.isFinite(stat.size) &&
    stat.size > maxBytes
  ) {
    throw new CapacitorFileReadLimitError(stat.size, maxBytes);
  }
  const { uri } = await filesystem.getUri(
    options as Parameters<PublicFilesystem['getUri']>[0],
  );
  const response = await fetch(Capacitor.convertFileSrc(uri));
  if (!response.ok) {
    throw new Error(`Failed to read native file: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
