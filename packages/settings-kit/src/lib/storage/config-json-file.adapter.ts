/**
 * File-backed storage adapter for app config persisted in config.json.
 * The configured primary key is stored as the whole file contents.
 */

import { StorageAdapter } from './storage.adapter';

type ConfigDirectory = 'DATA' | 'LIBRARY';

type FilesystemBackend = {
  Filesystem: {
    readFile(options: {
      path: string;
      directory: ConfigDirectory;
      encoding: 'utf8';
    }): Promise<{ data: string | unknown }>;
    writeFile(options: {
      path: string;
      data: string;
      directory: ConfigDirectory;
      encoding: 'utf8';
      recursive?: boolean;
    }): Promise<unknown>;
    deleteFile(options: {
      path: string;
      directory: ConfigDirectory;
    }): Promise<unknown>;
    stat(options: {
      path: string;
      directory: ConfigDirectory;
    }): Promise<unknown>;
  };
};

export interface ConfigJsonFileAdapterOptions {
  /**
   * Logical key backed by the config file.
   * Only this key is persisted in the file.
   */
  primaryKey: string;

  /**
   * File path relative to the chosen Capacitor directory.
   * Defaults to `config.json`.
   */
  path?: string;

  /**
   * Optional fallback adapter used only when Filesystem is unavailable.
   */
  fallbackAdapter?: StorageAdapter;
}

export class ConfigJsonFileAdapter implements StorageAdapter {
  private filesystem: FilesystemBackend | null = null;
  private filesystemInit: Promise<FilesystemBackend | null> | null = null;

  constructor(private readonly options: ConfigJsonFileAdapterOptions) {}

  async get(key: string): Promise<string | null> {
    if (!this.matchesPrimaryKey(key)) {
      return null;
    }

    const backend = await this.getFilesystem();
    if (!backend) {
      return this.options.fallbackAdapter?.get(key) ?? null;
    }

    try {
      const directory = await this.getDirectory(backend);
      const result = await backend.Filesystem.readFile({
        path: this.getPath(),
        directory,
        encoding: 'utf8',
      });

      return typeof result.data === 'string' ? result.data : null;
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return null;
      }

      console.warn('[settings-kit] config.json read failed:', error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.matchesPrimaryKey(key)) {
      return;
    }

    const backend = await this.getFilesystem();
    if (!backend) {
      await this.options.fallbackAdapter?.set(key, value);
      return;
    }

    try {
      const directory = await this.getDirectory(backend);
      await backend.Filesystem.writeFile({
        path: this.getPath(),
        data: value,
        directory,
        encoding: 'utf8',
        recursive: true,
      });
    } catch (error) {
      console.warn('[settings-kit] config.json write failed:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    if (!this.matchesPrimaryKey(key)) {
      return;
    }

    const backend = await this.getFilesystem();
    if (!backend) {
      await this.options.fallbackAdapter?.remove(key);
      return;
    }

    try {
      const directory = await this.getDirectory(backend);
      await backend.Filesystem.deleteFile({
        path: this.getPath(),
        directory,
      });
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return;
      }

      console.warn('[settings-kit] config.json delete failed:', error);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.matchesPrimaryKey(key)) {
      return false;
    }

    const backend = await this.getFilesystem();
    if (!backend) {
      return this.options.fallbackAdapter?.has(key) ?? false;
    }

    try {
      const directory = await this.getDirectory(backend);
      await backend.Filesystem.stat({
        path: this.getPath(),
        directory,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async getFilesystem(): Promise<FilesystemBackend | null> {
    if (this.filesystem) {
      return this.filesystem;
    }

    if (this.filesystemInit) {
      return this.filesystemInit;
    }

    this.filesystemInit = this.initFilesystem();
    this.filesystem = await this.filesystemInit;
    this.filesystemInit = null;
    return this.filesystem;
  }

  private async initFilesystem(): Promise<FilesystemBackend | null> {
    const filesystem = getCapacitorGlobal()?.Plugins?.Filesystem;
    return filesystem ? { Filesystem: filesystem } : null;
  }

  private async getDirectory(_: FilesystemBackend): Promise<ConfigDirectory> {
    const platform = await this.getPlatform();
    return platform === 'ios' ? 'LIBRARY' : 'DATA';
  }

  private async getPlatform(): Promise<string> {
    return getCapacitorGlobal()?.getPlatform?.() ?? 'web';
  }

  private getPath(): string {
    return this.options.path || 'config.json';
  }

  private matchesPrimaryKey(key: string): boolean {
    return key === this.options.primaryKey;
  }

  private isMissingFileError(error: unknown): boolean {
    const text =
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? `${error.name} ${error.message}`
          : String(error ?? '');

    const normalized = text.toLowerCase();
    return (
      normalized.includes('not found') ||
      normalized.includes('no such file') ||
      normalized.includes('enoent') ||
      normalized.includes('does not exist') ||
      normalized.includes('os-plug-file-0008')
    );
  }
}

type CapacitorGlobal = {
  getPlatform?: () => string;
  Plugins?: {
    Filesystem?: FilesystemBackend['Filesystem'];
  };
};

function getCapacitorGlobal(): CapacitorGlobal | null {
  const globalCapacitor = (
    globalThis as typeof globalThis & { Capacitor?: CapacitorGlobal }
  ).Capacitor;
  if (globalCapacitor) {
    return globalCapacitor;
  }

  const windowCapacitor = (
    globalThis as typeof globalThis & {
      window?: { Capacitor?: CapacitorGlobal };
    }
  ).window?.Capacitor;

  return windowCapacitor ?? null;
}
