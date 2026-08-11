import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileKitService } from './file-kit.service';
import { PUBLIC_FILESYSTEM, type PublicFilesystem } from './public-filesystem';

const DEFAULT_PUBLIC_DOCUMENTS_ROOTS = [
  '/storage/emulated/0/Documents',
  '/storage/self/primary/Documents',
  '/sdcard/Documents',
] as const;

type ListingSource = 'absolute' | 'documents-directory';

type ListingAttempt = {
  source: ListingSource;
  path: string;
  directory?: Directory;
};

export type EpubPublicFilesystem = PublicFilesystem;

export { PUBLIC_FILESYSTEM, type PublicFilesystem } from './public-filesystem';

export const EPUB_PUBLIC_FILESYSTEM = PUBLIC_FILESYSTEM;

export type EpubPublicStoreOptions = {
  epubFolder: string;
  /**
   * Android's shared public Documents path is not writable through the
   * Capacitor Filesystem API under scoped storage. Use the app Documents
   * directory with a relative path for stores that own their files.
   */
  useDocumentsDirectoryOnNative?: boolean;
  /** Physical Capacitor directory used by the relative store mode. */
  nativeDirectory?: Directory;
  /** Older private directories whose EPUBs should be copied into the public store. */
  legacyNativeDirectories?: Directory[];
  publicDocumentsRoot?: string;
  publicDocumentsRoots?: string[];
  debug?: boolean;
  logPrefix?: string;
  filesystem?: PublicFilesystem;
};

export class EpubPublicStore {
  private readonly publicDocumentsRoots: string[];
  private readonly debug: boolean;
  private readonly logPrefix: string;
  private readonly useDocumentsDirectory: boolean;
  private readonly storageDirectory: Directory;
  private readonly legacyNativeDirectories: Directory[];
  private readonly filesystem: PublicFilesystem;
  private hasMigratedLegacyNativeEpubs = false;
  private hasMigratedDocumentsToPublic = false;
  private activePublicDocumentsRoot: string;

  constructor(
    private readonly fileKit: FileKitService,
    private readonly options: EpubPublicStoreOptions,
  ) {
    this.useDocumentsDirectory =
      !Capacitor.isNativePlatform() ||
      !!options.useDocumentsDirectoryOnNative;
    this.filesystem = options.filesystem ?? Filesystem;
    this.storageDirectory = options.nativeDirectory ?? Directory.Documents;
    this.legacyNativeDirectories = options.legacyNativeDirectories ?? [];
    this.publicDocumentsRoots = this.resolvePublicDocumentsRoots(options);
    this.activePublicDocumentsRoot = this.publicDocumentsRoots[0];
    this.debug = !!options.debug;
    this.logPrefix = options.logPrefix ?? 'EpubPublicStore';
    this.debugLog('init', {
      epubFolder: this.options.epubFolder,
      publicDocumentsRoots: this.publicDocumentsRoots,
    });
  }

  get folder(): string {
    return this.options.epubFolder;
  }

  get publicFolderPath(): string {
    if (this.useDocumentsDirectory) {
      return this.options.epubFolder;
    }
    return this.buildPublicFolderPath(this.activePublicDocumentsRoot);
  }

  get publicFolderPaths(): string[] {
    if (this.useDocumentsDirectory) {
      return [this.options.epubFolder];
    }
    return this.publicDocumentsRoots.map((root) => this.buildPublicFolderPath(root));
  }

  pathFor(filename: string): string {
    return `${this.publicFolderPath}/${filename}`;
  }

  relativePathFor(filename: string): string {
    return `${this.options.epubFolder}/${filename}`;
  }

  async nativePathFor(filename: string): Promise<string> {
    await this.ensureReady();
    if (!this.useDocumentsDirectory) {
      return this.pathFor(filename);
    }

    const result = await this.filesystem.getUri({
      directory: this.storageDirectory,
      path: this.relativePathFor(filename),
    });
    return this.toNativePath(result.uri);
  }

  async ensureReady(): Promise<void> {
    await this.ensurePublicFolderExists();
    await this.migrateLegacyNativeEpubsOnce();
    if (this.useDocumentsDirectory) {
      return;
    }
    await this.migrateDocumentsEpubsToPublicOnce();
  }

  async listEpubs(): Promise<string[]> {
    await this.ensureReady();
    const attempts = this.buildListingAttempts();
    const merged = new Set<string>();
    let hadSuccess = false;
    const failures: Array<{
      source: ListingSource;
      path: string;
      directory?: Directory;
      error: Record<string, unknown>;
    }> = [];

    for (const attempt of attempts) {
      try {
        const raw = await this.readdirForAttempt(attempt);
        const normalizedEntries = this.normalizeDirectoryEntries(raw?.files);
        const filtered = this.filterEpubNames(normalizedEntries);
        filtered.forEach((filename) => merged.add(filename));
        hadSuccess = true;

        if (attempt.source === 'absolute') {
          const resolvedRoot = this.publicDocumentsRoots.find(
            (root) => this.buildPublicFolderPath(root) === attempt.path,
          );
          if (resolvedRoot) {
            this.activePublicDocumentsRoot = resolvedRoot;
          }
        }

        this.debugLog('listEpubs:readdir:success', {
          source: attempt.source,
          resolvedFolderPath: attempt.path,
          directory: attempt.directory,
          rawReaddirResponse: raw,
          filteredResult: filtered,
        });
      } catch (error) {
        const errorDetails = this.errorDetails(error);
        failures.push({
          source: attempt.source,
          path: attempt.path,
          directory: attempt.directory,
          error: errorDetails,
        });
      }
    }

    const result = Array.from(merged).sort((a, b) => a.localeCompare(b));
    this.debugLog('listEpubs:result', {
      attemptedPaths: attempts.map((attempt) => ({
        source: attempt.source,
        path: attempt.path,
        directory: attempt.directory,
      })),
      filteredResult: result,
      hadSuccess,
      failureCount: failures.length,
    });

    return result;
  }

  async writeEpub(filename: string, bytes: Uint8Array): Promise<void> {
    await this.ensureReady();
    await this.writeTargetEpub(filename, this.fileKit.toBase64(bytes));
    this.debugLog('writeEpub', {
      filename,
      bytes: bytes.byteLength,
      targetPath: this.pathFor(filename),
      writeCompletedAt: new Date().toISOString(),
    });
  }

  async deleteEpub(filename: string): Promise<void> {
    for (const path of this.buildFilePathCandidates(filename)) {
      try {
        await this.filesystem.deleteFile(this.buildFilesystemPath(path));
        this.debugLog('deleteEpub', { filename, path });
        return;
      } catch (error) {
        if (this.isNotFoundError(error)) {
          continue;
        }
      }
    }
    this.debugLog('deleteEpub:notFound', {
      filename,
      attemptedPaths: this.buildFilePathCandidates(filename),
    });
  }

  async renameEpub(fromFilename: string, toFilename: string): Promise<void> {
    await this.ensureReady();
    const fromPath = await this.resolveExistingPath(fromFilename);
    if (!fromPath) {
      throw new Error(`File not found: ${fromFilename}`);
    }
    const folderPath = fromPath.slice(0, fromPath.lastIndexOf('/'));
    const toPath = `${folderPath}/${toFilename}`;

    const renameOptions = this.buildFilesystemPath(fromPath);
    await this.filesystem.rename({
      from: fromPath,
      to: toPath,
      ...(renameOptions.directory
        ? { directory: renameOptions.directory }
        : {}),
    });
    this.debugLog('renameEpub', {
      from: fromFilename,
      to: toFilename,
      fromPath,
      toPath,
    });
  }

  async exists(filename: string): Promise<boolean> {
    const existingPath = await this.resolveExistingPath(filename);
    return !!existingPath;
  }

  async readBytes(filename: string): Promise<Uint8Array> {
    const path = await this.resolveExistingPath(filename);
    if (!path) {
      throw new Error(`File not found: ${filename}`);
    }

    const raw = await this.filesystem.readFile(this.buildFilesystemPath(path));
    const base64 = typeof raw.data === 'string'
      ? raw.data
      : this.fileKit.toBase64(new Uint8Array(await raw.data.arrayBuffer()));
    this.debugLog('readBytes', { filename, path });
    return this.fileKit.fromBase64(this.normalizeBase64Data(base64));
  }

  async getUriOrThrow(filename: string): Promise<string> {
    const absolutePath = await this.resolveExistingPath(filename);
    if (!absolutePath) {
      throw new Error(`File not found: ${filename}`);
    }
    const uri = await this.getUriForPath(absolutePath);
    this.debugLog('getUriOrThrow', { filename, absolutePath, uri });
    return uri;
  }

  async getFileSizeOrThrow(filename: string): Promise<number> {
    const path = await this.resolveExistingPath(filename);
    if (!path) {
      throw new Error(`File not found: ${filename}`);
    }

    const stat = await this.filesystem.stat(this.buildFilesystemPath(path));
    return typeof stat.size === 'number' ? stat.size : 0;
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
    if (this.useDocumentsDirectory) {
      try {
        await this.filesystem.mkdir({
          path: this.options.epubFolder,
          directory: this.storageDirectory,
          recursive: true,
        });
      } catch {
        // best effort on web
      }
      return;
    }

    for (const root of this.publicDocumentsRoots) {
      const folderPath = this.buildPublicFolderPath(root);
      try {
        await this.filesystem.mkdir({ path: folderPath, recursive: true });
        this.activePublicDocumentsRoot = root;
        this.debugLog('ensurePublicFolderExists:ok', {
          resolvedFolderPath: folderPath,
        });
        return;
      } catch (error) {
        void error;
      }
    }
  }

  private async migrateDocumentsEpubsToPublicOnce(): Promise<void> {
    if (this.useDocumentsDirectory) {
      return;
    }
    if (this.hasMigratedDocumentsToPublic) {
      return;
    }
    this.hasMigratedDocumentsToPublic = true;

    const documentFiles = await this.listDirectoryDocumentsEpubs();
    const migrated: string[] = [];
    const failed: string[] = [];
    this.debugLog('migrate:start', {
      sourceListingResult: documentFiles,
      count: documentFiles.length,
    });

    for (const filename of documentFiles) {
      const alreadyInPublic = await this.exists(filename);
      if (alreadyInPublic) {
        continue;
      }

      try {
        const relativePath = this.relativePathFor(filename);
        await this.filesystem.copy({
          directory: Directory.Documents,
          from: relativePath,
          to: this.pathFor(filename),
        });
        await this.deleteDocumentEpubIfExists(relativePath);
        migrated.push(filename);
        this.debugLog('migrate:migrated', {
          filename,
          destinationPath: this.pathFor(filename),
        });
      } catch (error) {
        failed.push(filename);
        void error;
      }
    }

    this.debugLog('migrate:done', {
      sourceCount: documentFiles.length,
      migratedFilenames: migrated,
      migrationFailures: failed,
    });
  }

  private async listDirectoryDocumentsEpubs(): Promise<string[]> {
    try {
      const list = await this.filesystem.readdir(
        this.buildFilesystemPath(this.options.epubFolder),
      );
      const names = this.normalizeDirectoryEntries(list.files);
      const filtered = this.filterEpubNames(names);
      this.debugLog('migrate:listDirectoryDocumentsEpubs:success', {
        sourcePath: this.options.epubFolder,
        rawReaddirResponse: list,
        filteredResult: filtered,
      });
      return filtered;
    } catch (error) {
      void error;
      return [];
    }
  }

  private resolvePublicDocumentsRoots(options: EpubPublicStoreOptions): string[] {
    const configuredRoots = options.publicDocumentsRoots?.length
      ? options.publicDocumentsRoots
      : options.publicDocumentsRoot
        ? [options.publicDocumentsRoot]
        : [...DEFAULT_PUBLIC_DOCUMENTS_ROOTS];
    const merged = [...configuredRoots, ...DEFAULT_PUBLIC_DOCUMENTS_ROOTS];
    const normalized = merged
      .map((path) => this.trimTrailingSlash(path))
      .filter((path) => !!path);
    return Array.from(new Set(normalized));
  }

  private trimTrailingSlash(path: string): string {
    return path.replace(/[\\/]+$/, '');
  }

  private buildPublicFolderPath(root: string): string {
    return `${this.trimTrailingSlash(root)}/${this.options.epubFolder}`;
  }

  private buildListingAttempts(): ListingAttempt[] {
    if (this.useDocumentsDirectory) {
      return [
        {
          source: 'documents-directory',
          path: this.options.epubFolder,
          directory: this.storageDirectory,
        },
      ];
    }

    const absoluteAttempts: ListingAttempt[] = this.publicFolderPaths.map((path) => ({
      source: 'absolute',
      path,
    }));
    const documentsAttempt: ListingAttempt = {
      source: 'documents-directory',
      path: this.options.epubFolder,
      directory: Directory.Documents,
    };
    return [...absoluteAttempts, documentsAttempt];
  }

  private async readdirForAttempt(attempt: ListingAttempt): Promise<any> {
    return this.filesystem.readdir(this.buildFilesystemPath(attempt.path, attempt.directory));
  }

  private async migrateLegacyNativeEpubsOnce(): Promise<void> {
    if (this.hasMigratedLegacyNativeEpubs || this.legacyNativeDirectories.length === 0) {
      return;
    }
    this.hasMigratedLegacyNativeEpubs = true;

    for (const directory of this.legacyNativeDirectories) {
      let filenames: string[];
      try {
        const listing = await this.filesystem.readdir({
          directory,
          path: this.options.epubFolder,
        });
        filenames = this.filterEpubNames(
          this.normalizeDirectoryEntries(listing.files),
        );
      } catch {
        continue;
      }

      for (const filename of filenames) {
        if (await this.exists(filename)) {
          continue;
        }

        try {
          const sourcePath = this.relativePathFor(filename);
          const destinationPath = this.useDocumentsDirectory
            ? sourcePath
            : this.pathFor(filename);
          await this.filesystem.copy({
            directory,
            from: sourcePath,
            to: destinationPath,
            ...(this.useDocumentsDirectory
              ? { toDirectory: this.storageDirectory }
              : {}),
          });
          await this.filesystem.deleteFile({
            directory,
            path: sourcePath,
          });
        } catch {
          continue;
        }
      }
    }
  }

  private async writeTargetEpub(filename: string, data: string): Promise<void> {
    if (this.useDocumentsDirectory) {
      await this.filesystem.writeFile({
        directory: this.storageDirectory,
        path: this.relativePathFor(filename),
        data,
        recursive: true,
      });
      return;
    }

    await this.filesystem.writeFile({
      path: this.pathFor(filename),
      data,
      recursive: true,
    });
  }

  private normalizeDirectoryEntries(files: unknown): string[] {
    if (!Array.isArray(files)) {
      return [];
    }
    return files
      .map((entry) => this.resolveDirectoryEntryName(entry))
      .filter((name): name is string => !!name);
  }

  private resolveDirectoryEntryName(entry: unknown): string | null {
    if (typeof entry === 'string') {
      return entry.trim() || null;
    }

    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const byName = (entry as { name?: unknown }).name;
    if (typeof byName === 'string' && byName.trim()) {
      return byName.trim();
    }

    const byPath = (entry as { path?: unknown }).path;
    if (typeof byPath === 'string' && byPath.trim()) {
      const name = byPath.split('/').pop();
      return name?.trim() || null;
    }

    const byUri = (entry as { uri?: unknown }).uri;
    if (typeof byUri === 'string' && byUri.trim()) {
      const name = byUri.split('/').pop();
      return name?.trim() || null;
    }

    return null;
  }

  private filterEpubNames(names: string[]): string[] {
    return names.filter((name) => name.toLowerCase().endsWith('.epub'));
  }

  private buildFilePathCandidates(filename: string): string[] {
    if (this.useDocumentsDirectory) {
      return [`${this.options.epubFolder}/${filename}`];
    }

    return [
      ...this.publicFolderPaths.map((folderPath) => `${folderPath}/${filename}`),
      `${this.options.epubFolder}/${filename}`,
    ];
  }

  private async resolveExistingPath(filename: string): Promise<string | null> {
    for (const candidate of this.buildFilePathCandidates(filename)) {
      try {
        await this.filesystem.stat(this.buildFilesystemPath(candidate));
        return candidate;
      } catch {
        // continue
      }
    }
    return null;
  }

  private isNotFoundError(error: unknown): boolean {
    const haystack = [
      (error as { message?: string })?.message,
      (error as { code?: string | number })?.code,
      String(error),
    ]
      .filter((part) => part !== undefined && part !== null)
      .join(' ')
      .toLowerCase();
    return haystack.includes('not found') || haystack.includes('enoent');
  }

  private errorDetails(error: unknown): Record<string, unknown> {
    if (error && typeof error === 'object') {
      const e = error as {
        name?: unknown;
        message?: unknown;
        code?: unknown;
        stack?: unknown;
      };
      return {
        name: typeof e.name === 'string' ? e.name : undefined,
        message: typeof e.message === 'string' ? e.message : undefined,
        code: typeof e.code === 'string' || typeof e.code === 'number' ? e.code : undefined,
        stack: typeof e.stack === 'string' ? e.stack : undefined,
      };
    }
    return { message: String(error) };
  }

  private buildFilesystemPath(
    path: string,
    directory?: Directory,
  ): { path: string; directory?: Directory } {
    if (directory) {
      return { path, directory };
    }

    if (
      this.useDocumentsDirectory ||
      path === this.options.epubFolder ||
      path.startsWith(`${this.options.epubFolder}/`)
    ) {
      return { path, directory: this.storageDirectory };
    }

    return { path };
  }

  private async getUriForPath(path: string): Promise<string> {
    const isDocumentsPath =
      this.useDocumentsDirectory ||
      path === this.options.epubFolder ||
      path.startsWith(`${this.options.epubFolder}/`);

    if (isDocumentsPath) {
      const result = await this.filesystem.getUri({
        path,
        directory: this.storageDirectory,
      });
      return result.uri;
    }

    return `file://${path}`;
  }

  private normalizeBase64Data(data: string): string {
    const commaIdx = data.indexOf(',');
    if (commaIdx > -1) {
      return data.slice(commaIdx + 1);
    }
    return data;
  }

  private toNativePath(uri: string): string {
    if (!uri.startsWith('file://')) {
      return uri;
    }
    return decodeURIComponent(uri.replace(/^file:\/\//, ''));
  }

  private debugLog(event: string, payload?: Record<string, unknown>): void {
    if (!this.debug) return;
    void event;
    void payload;
  }
}
