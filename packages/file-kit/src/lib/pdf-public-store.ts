import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileKitService } from './file-kit.service';
import { type PublicFilesystem } from './public-filesystem';

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

export type PdfPublicStoreOptions = {
  pdfFolder: string;
  useDocumentsDirectoryOnNative?: boolean;
  nativeDirectory?: Directory;
  publicDocumentsRoot?: string;
  publicDocumentsRoots?: string[];
  debug?: boolean;
  logPrefix?: string;
  filesystem?: PublicFilesystem;
};

export class PdfPublicStore {
  private readonly publicDocumentsRoots: string[];
  private readonly debug: boolean;
  private readonly logPrefix: string;
  private readonly useDocumentsDirectory: boolean;
  private readonly storageDirectory: Directory;
  private readonly filesystem: PublicFilesystem;
  private hasMigratedDocumentsToPublic = false;
  private activePublicDocumentsRoot: string;

  constructor(
    private readonly fileKit: FileKitService,
    private readonly options: PdfPublicStoreOptions,
  ) {
    this.useDocumentsDirectory =
      !Capacitor.isNativePlatform() ||
      !!options.useDocumentsDirectoryOnNative;
    this.storageDirectory = options.nativeDirectory ?? Directory.Documents;
    this.filesystem = options.filesystem ?? Filesystem;
    this.publicDocumentsRoots = this.resolvePublicDocumentsRoots(options);
    this.activePublicDocumentsRoot = this.publicDocumentsRoots[0];
    this.debug = !!options.debug;
    this.logPrefix = options.logPrefix ?? 'PdfPublicStore';
  }

  get folder(): string {
    return this.options.pdfFolder;
  }

  get publicFolderPath(): string {
    if (this.useDocumentsDirectory) {
      return this.options.pdfFolder;
    }
    return this.buildPublicFolderPath(this.activePublicDocumentsRoot);
  }

  get publicFolderPaths(): string[] {
    if (this.useDocumentsDirectory) {
      return [this.options.pdfFolder];
    }
    return this.publicDocumentsRoots.map((root) =>
      this.buildPublicFolderPath(root),
    );
  }

  pathFor(filename: string): string {
    return `${this.publicFolderPath}/${filename}`;
  }

  relativePathFor(filename: string): string {
    return `${this.options.pdfFolder}/${filename}`;
  }

  async ensureReady(): Promise<void> {
    await this.ensurePublicFolderExists();
    await this.migrateDocumentsPdfsToPublicOnce();
  }

  async listPdfs(): Promise<string[]> {
    const attempts = this.buildListingAttempts();
    const merged = new Set<string>();
    let hadSuccess = false;

    for (const attempt of attempts) {
      try {
        const raw = await this.readdirForAttempt(attempt);
        const normalizedEntries = this.normalizeDirectoryEntries(raw?.files);
        const filtered = this.filterPdfNames(normalizedEntries);
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
      } catch {
        // keep trying other roots
      }
    }

    const result = Array.from(merged).sort((a, b) => a.localeCompare(b));
    this.debugLog('listPdfs', { count: result.length, files: result });
    if (hadSuccess) return result;
    throw new Error(
      `[${this.logPrefix}] listPdfs failed for all discovery attempts (${attempts.length})`,
    );
  }

  async writePdf(filename: string, bytes: Uint8Array): Promise<void> {
    await this.ensureReady();
    await this.writeTargetPdf(filename, this.fileKit.toBase64(bytes));
  }

  async deletePdf(filename: string): Promise<void> {
    for (const path of this.buildFilePathCandidates(filename)) {
      try {
        await this.filesystem.deleteFile(this.buildFilesystemPath(path));
        return;
      } catch (error) {
        if (this.isNotFoundError(error)) continue;
      }
    }
  }

  async renamePdf(fromFilename: string, toFilename: string): Promise<void> {
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
      ...(renameOptions.directory ? { directory: renameOptions.directory } : {}),
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
    const base64 =
      typeof raw.data === 'string'
        ? raw.data
        : this.fileKit.toBase64(new Uint8Array(await raw.data.arrayBuffer()));
    return this.fileKit.fromBase64(this.normalizeBase64Data(base64));
  }

  async getUriOrThrow(filename: string): Promise<string> {
    const absolutePath = await this.resolveExistingPath(filename);
    if (!absolutePath) {
      throw new Error(`File not found: ${filename}`);
    }
    return this.getUriForPath(absolutePath);
  }

  async deleteDocumentPdfIfExists(relativePath: string): Promise<void> {
    try {
      await this.fileKit.delete({
        dir: 'Documents',
        path: relativePath,
      });
    } catch {
      // best effort
    }
  }

  private async ensurePublicFolderExists(): Promise<void> {
    if (this.useDocumentsDirectory) {
      try {
        await this.filesystem.mkdir({
          path: this.options.pdfFolder,
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
        await this.filesystem.mkdir({
          path: folderPath,
          recursive: true,
        });
        this.activePublicDocumentsRoot = root;
        return;
      } catch {
        // keep trying
      }
    }
  }

  private async migrateDocumentsPdfsToPublicOnce(): Promise<void> {
    if (this.useDocumentsDirectory) return;
    if (this.hasMigratedDocumentsToPublic) return;
    this.hasMigratedDocumentsToPublic = true;

    const documentFiles = await this.listDirectoryDocumentsPdfs();
    for (const filename of documentFiles) {
      const alreadyInPublic = await this.exists(filename);
      if (alreadyInPublic) continue;
      try {
        const relativePath = this.relativePathFor(filename);
        await this.filesystem.copy({
          directory: Directory.Documents,
          from: relativePath,
          to: this.pathFor(filename),
        });
        await this.deleteDocumentPdfIfExists(relativePath);
      } catch {
        // best effort migration
      }
    }
  }

  private async listDirectoryDocumentsPdfs(): Promise<string[]> {
    try {
      const list = await this.filesystem.readdir({
        directory: Directory.Documents,
        path: this.options.pdfFolder,
      });
      const names = this.normalizeDirectoryEntries(list.files);
      return this.filterPdfNames(names);
    } catch {
      return [];
    }
  }

  private resolvePublicDocumentsRoots(options: PdfPublicStoreOptions): string[] {
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
    return `${this.trimTrailingSlash(root)}/${this.options.pdfFolder}`;
  }

  private buildListingAttempts(): ListingAttempt[] {
    if (this.useDocumentsDirectory) {
      return [
        {
          source: 'documents-directory',
          path: this.options.pdfFolder,
          directory: this.storageDirectory,
        },
      ];
    }

    const absoluteAttempts: ListingAttempt[] = this.publicFolderPaths.map(
      (path) => ({
        source: 'absolute',
        path,
      }),
    );
    const documentsAttempt: ListingAttempt = {
      source: 'documents-directory',
      path: this.options.pdfFolder,
      directory: Directory.Documents,
    };
    return [...absoluteAttempts, documentsAttempt];
  }

  private async readdirForAttempt(attempt: ListingAttempt): Promise<any> {
    return this.filesystem.readdir(
      this.buildFilesystemPath(attempt.path, attempt.directory),
    );
  }

  private normalizeDirectoryEntries(files: unknown): string[] {
    if (!Array.isArray(files)) return [];
    return files
      .map((entry) => this.resolveDirectoryEntryName(entry))
      .filter((name): name is string => !!name);
  }

  private resolveDirectoryEntryName(entry: unknown): string | null {
    if (typeof entry === 'string') return entry.trim() || null;
    if (!entry || typeof entry !== 'object') return null;

    const byName = (entry as { name?: unknown }).name;
    if (typeof byName === 'string' && byName.trim()) return byName.trim();

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

  private filterPdfNames(names: string[]): string[] {
    return names.filter((name) => name.toLowerCase().endsWith('.pdf'));
  }

  private buildFilePathCandidates(filename: string): string[] {
    return this.publicFolderPaths.map((folderPath) => `${folderPath}/${filename}`);
  }

  private async resolveExistingPath(filename: string): Promise<string | null> {
    for (const candidate of this.buildFilePathCandidates(filename)) {
      try {
        await this.filesystem.stat(this.buildFilesystemPath(candidate));
        return candidate;
      } catch {
        // keep trying
      }
    }
    return null;
  }

  private async writeTargetPdf(filename: string, data: string): Promise<void> {
    await this.filesystem.writeFile({
      ...this.buildFilesystemPath(this.relativePathFor(filename)),
      data,
      recursive: true,
    });
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
      path === this.options.pdfFolder ||
      path.startsWith(`${this.options.pdfFolder}/`)
    ) {
      return { path, directory: this.storageDirectory };
    }

    return { path };
  }

  private async getUriForPath(path: string): Promise<string> {
    const isDocumentsPath =
      this.useDocumentsDirectory ||
      path === this.options.pdfFolder ||
      path.startsWith(`${this.options.pdfFolder}/`);

    if (isDocumentsPath) {
      const result = await this.filesystem.getUri({
        path,
        directory: this.storageDirectory,
      });
      return result.uri;
    }

    return `file://${path}`;
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

  private normalizeBase64Data(data: string): string {
    const commaIdx = data.indexOf(',');
    if (commaIdx > -1) {
      return data.slice(commaIdx + 1);
    }
    return data;
  }

  private debugLog(event: string, payload?: Record<string, unknown>): void {
    if (!this.debug) return;
    void event;
    void payload;
  }
}
