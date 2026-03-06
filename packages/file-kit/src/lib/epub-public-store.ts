import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileKitService } from './file-kit.service';

export type EpubPublicStoreOptions = {
  epubFolder: string;
  publicDocumentsRoot?: string;
  debug?: boolean;
  logPrefix?: string;
};

export class EpubPublicStore {
  private readonly publicDocumentsRoot: string;
  private readonly debug: boolean;
  private readonly logPrefix: string;
  private hasMigratedDocumentsToPublic = false;

  constructor(
    private readonly fileKit: FileKitService,
    private readonly options: EpubPublicStoreOptions,
  ) {
    this.publicDocumentsRoot = options.publicDocumentsRoot ?? '/storage/emulated/0/Documents';
    this.debug = !!options.debug;
    this.logPrefix = options.logPrefix ?? 'EpubPublicStore';
  }

  get folder(): string {
    return this.options.epubFolder;
  }

  get publicFolderPath(): string {
    return `${this.publicDocumentsRoot}/${this.options.epubFolder}`;
  }

  pathFor(filename: string): string {
    return `${this.publicFolderPath}/${filename}`;
  }

  relativePathFor(filename: string): string {
    return `${this.options.epubFolder}/${filename}`;
  }

  async ensureReady(): Promise<void> {
    await this.ensurePublicFolderExists();
    await this.migrateDocumentsEpubsToPublicOnce();
  }

  async listEpubs(): Promise<string[]> {
    try {
      const list = await Filesystem.readdir({
        path: this.publicFolderPath,
      });
      return (list.files ?? [])
        .map((f: any) => (typeof f === 'string' ? f : f.name))
        .filter((name: string) => name.toLowerCase().endsWith('.epub'));
    } catch {
      return [];
    }
  }

  async writeEpub(filename: string, bytes: Uint8Array): Promise<void> {
    await this.ensureReady();
    await Filesystem.writeFile({
      path: this.pathFor(filename),
      data: this.fileKit.toBase64(bytes),
      recursive: true,
    });
    this.debugLog('writeEpub', { filename, bytes: bytes.byteLength });
  }

  async deleteEpub(filename: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        path: this.pathFor(filename),
      });
      this.debugLog('deleteEpub', { filename });
    } catch {
      // ignore missing public file
    }
  }

  async renameEpub(fromFilename: string, toFilename: string): Promise<void> {
    await this.ensureReady();
    await Filesystem.rename({
      from: this.pathFor(fromFilename),
      to: this.pathFor(toFilename),
    });
    this.debugLog('renameEpub', { from: fromFilename, to: toFilename });
  }

  async exists(filename: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path: this.pathFor(filename),
      });
      return true;
    } catch {
      return false;
    }
  }

  async readBytes(filename: string): Promise<Uint8Array> {
    const raw = await Filesystem.readFile({
      path: this.pathFor(filename),
    });
    const base64 = typeof raw.data === 'string'
      ? raw.data
      : this.fileKit.toBase64(new Uint8Array(await raw.data.arrayBuffer()));
    return this.fileKit.fromBase64(this.normalizeBase64Data(base64));
  }

  async getUriOrThrow(filename: string): Promise<string> {
    const absolutePath = this.pathFor(filename);
    try {
      await Filesystem.stat({
        path: absolutePath,
      });
      const uri = `file://${absolutePath}`;
      this.debugLog('getUriOrThrow', { filename, uri });
      return uri;
    } catch {
      throw new Error(`File not found: ${absolutePath}`);
    }
  }

  async deleteDocumentEpubIfExists(relativePath: string): Promise<void> {
    try {
      await this.fileKit.delete({
        dir: 'Documents',
        path: relativePath,
      });
      this.debugLog('deleteDocumentEpubIfExists', { relativePath });
    } catch {
      // old storage location may not exist
    }
  }

  private async ensurePublicFolderExists(): Promise<void> {
    await Filesystem.mkdir({
      path: this.publicFolderPath,
      recursive: true,
    }).catch(() => undefined);
  }

  private async migrateDocumentsEpubsToPublicOnce(): Promise<void> {
    if (this.hasMigratedDocumentsToPublic) {
      return;
    }
    this.hasMigratedDocumentsToPublic = true;

    const documentFiles = await this.listDirectoryDocumentsEpubs();
    this.debugLog('migrate:start', { count: documentFiles.length });

    for (const filename of documentFiles) {
      const alreadyInPublic = await this.exists(filename);
      if (alreadyInPublic) {
        continue;
      }

      try {
        const relativePath = this.relativePathFor(filename);
        const bytes = await this.fileKit.readBytes({
          dir: 'Documents',
          path: relativePath,
        });
        await Filesystem.writeFile({
          path: this.pathFor(filename),
          data: this.fileKit.toBase64(bytes),
          recursive: true,
        });
        await this.deleteDocumentEpubIfExists(relativePath);
        this.debugLog('migrate:migrated', { filename, bytes: bytes.byteLength });
      } catch {
        this.debugLog('migrate:failed', { filename });
      }
    }

    this.debugLog('migrate:done');
  }

  private async listDirectoryDocumentsEpubs(): Promise<string[]> {
    try {
      const list = await Filesystem.readdir({
        directory: Directory.Documents,
        path: this.options.epubFolder,
      });
      return (list.files ?? [])
        .map((f: any) => (typeof f === 'string' ? f : f.name))
        .filter((name: string) => name.toLowerCase().endsWith('.epub'));
    } catch {
      return [];
    }
  }

  private normalizeBase64Data(data: string): string {
    const commaIdx = data.indexOf(',');
    if (commaIdx > -1) {
      return data.slice(commaIdx + 1);
    }
    return data;
  }

  private debugLog(event: string, payload?: Record<string, unknown>): void {
    if (!this.debug) return;
    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.info(`[${this.logPrefix}] ${event}${suffix}`);
  }
}
