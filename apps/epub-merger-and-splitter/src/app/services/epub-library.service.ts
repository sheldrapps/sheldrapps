import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  EpubPublicStore,
  PUBLIC_FILESYSTEM,
  FileKitService,
  EpubRewriteService,
  WEB_EPUB_COVER_SERVICE_TOKEN,
  type WebEpubCoverService,
} from '@sheldrapps/file-kit';

export type LibraryPreviewAsset = {
  src: string;
  isDithered: boolean;
};

type PersistedPreviewAsset = {
  mimeType: string;
  dataBase64: string;
  isDithered: boolean;
};

export type EpubLibraryOperation = 'merge' | 'split';

export type EpubLibraryRecord = {
  id: string;
  filename: string;
  title: string;
  uri: string | null;
  thumbnailUri?: string;
  sizeBytes: number;
  createdAt: string;
  operation: EpubLibraryOperation;
  operationId: string;
  partIndex: number;
};

export type SaveExportedEpubRequest = {
  sourceUri: string;
  proposedFileName: string;
  title: string;
  operation: EpubLibraryOperation;
  operationId: string;
  partIndex: number;
};

type EpubLibraryIndex = {
  schemaVersion: 1;
  records: EpubLibraryRecord[];
};

@Injectable({ providedIn: 'root' })
export class EpubLibraryService {
  private readonly fileKit = inject(FileKitService);
  private readonly epubRewrite = inject(EpubRewriteService);
  private readonly nativeFilesystem = inject(PUBLIC_FILESYSTEM);
  private readonly webEpubCover = inject(WEB_EPUB_COVER_SERVICE_TOKEN, {
    optional: true,
  }) as WebEpubCoverService | null;

  private readonly epubStore = new EpubPublicStore(this.fileKit, {
    epubFolder: 'EpubMergerAndSplitter',
    useDocumentsDirectoryOnNative: true,
    filesystem: this.nativeFilesystem,
    logPrefix: 'EMAS:library',
  });
  private readonly previewThumbFolder = 'EpubMergerAndSplitterThumbs';
  private readonly libraryIndexPath = 'EpubMergerAndSplitter/library-index.json';

  private readonly previewCache = new Map<string, LibraryPreviewAsset>();
  private readonly publicEpubFolder = 'EpubMergerAndSplitter';

  async listEpubs(): Promise<string[]> {
    return (await this.listRecords()).map((record) => record.filename);
  }

  async listRecords(): Promise<readonly EpubLibraryRecord[]> {
    const [filenames, index] = await Promise.all([
      this.listPublicEpubFilenames(),
      this.readLibraryIndex(),
    ]);
    const currentNames = new Set(filenames);
    const recordsByFilename = new Map(
      index.records.map((record) => [record.filename, record]),
    );
    const records = filenames.map((filename) => {
      const existing = recordsByFilename.get(filename);
      return existing ?? this.createLegacyRecord(filename);
    });
    const nextRecords = index.records.filter((record) =>
      currentNames.has(record.filename),
    );
    if (nextRecords.length !== index.records.length) {
      await this.writeLibraryIndex({ schemaVersion: 1, records: nextRecords });
    }

    return records.sort((left, right) => this.compareRecords(left, right));
  }

  async saveExportedEpub(
    sourceUri: string,
    outputName: string,
  ): Promise<EpubLibraryRecord> {
    const [saved] = await this.saveExportedEpubs([
      {
        sourceUri,
        proposedFileName: outputName,
        title: this.titleFromFilename(outputName),
        operation: 'merge',
        operationId: crypto.randomUUID(),
        partIndex: 0,
      },
    ]);
    return saved;
  }

  async saveExportedEpubs(
    requests: readonly SaveExportedEpubRequest[],
  ): Promise<readonly EpubLibraryRecord[]> {
    if (requests.length === 0) {
      return [];
    }

    const [existingFilenames, index] = await Promise.all([
      this.listPublicEpubFilenames(),
      this.readLibraryIndex(),
    ]);
    const usedNames = new Set(existingFilenames);
    const createdAt = new Date().toISOString();
    const pending = requests.map((request) => {
      const filename = this.resolveUniqueFilename(request.proposedFileName, usedNames);
      usedNames.add(filename);
      return {
        request,
        record: {
          id: crypto.randomUUID(),
          filename,
          title: request.title.trim() || this.titleFromFilename(filename),
          uri: null,
          sizeBytes: 0,
          createdAt,
          operation: request.operation,
          operationId: request.operationId,
          partIndex: request.partIndex,
        } as EpubLibraryRecord,
      };
    });
    const savedFilenames: string[] = [];

    try {
      for (const entry of pending) {
        const published = this.epubRewrite.isSupported()
          ? await this.epubRewrite.publishPublicDocument({
              folderName: this.publicEpubFolder,
              sourcePath: entry.request.sourceUri,
              outputName: entry.record.filename,
              mimeType: 'application/epub+zip',
            })
          : null;
        if (!published) {
          const bytes = await this.readExportBytes(entry.request.sourceUri);
          await this.epubStore.writeEpub(entry.record.filename, bytes);
          await this.scanPublicEpub(entry.record.filename);
          entry.record.sizeBytes = bytes.byteLength;
          entry.record.uri = await this.epubStore.getUriOrThrow(entry.record.filename);
        } else {
          entry.record.sizeBytes = published.size;
          entry.record.uri = published.uri;
        }
        savedFilenames.push(entry.record.filename);
        await this.deletePersistedPreviewAsset(entry.record.filename);
        this.previewCache.delete(entry.record.filename);
        const preview = await this.refreshPreviewAsset(
          entry.record.filename,
        ).catch(() => null);
        entry.record.thumbnailUri = preview?.src || undefined;
      }

      const retainedRecords = index.records.filter(
        (record) => !savedFilenames.includes(record.filename),
      );
      await this.writeLibraryIndex({
        schemaVersion: 1,
        records: [...retainedRecords, ...pending.map((entry) => entry.record)],
      });
      return pending.map((entry) => entry.record);
    } catch (error) {
      await Promise.allSettled(
        savedFilenames.map((filename) => this.deleteByFilename(filename)),
      );
      throw error;
    }
  }

  async deleteByFilename(filename: string): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    if (this.epubRewrite.isSupported()) {
      await this.epubRewrite.deletePublicDocument(this.publicEpubFolder, resolved);
    } else {
      await this.epubStore.deleteEpub(resolved);
    }
    await this.deletePersistedPreviewAsset(resolved);
    this.previewCache.delete(resolved);
    const index = await this.readLibraryIndex();
    const nextRecords = index.records.filter(
      (record) => record.filename !== resolved,
    );
    if (nextRecords.length !== index.records.length) {
      await this.writeLibraryIndex({ schemaVersion: 1, records: nextRecords });
    }
  }

  async renameByFilename(filename: string, requestedName: string): Promise<string> {
    const resolved = this.ensureEpubFilename(filename);
    const [existingFilenames, index] = await Promise.all([
      this.listPublicEpubFilenames(),
      this.readLibraryIndex(),
    ]);
    const usedNames = new Set(
      existingFilenames.filter((candidate) => candidate !== resolved),
    );
    const nextFilename = this.resolveUniqueFilename(requestedName, usedNames);

    if (resolved === nextFilename) {
      return resolved;
    }

    if (this.epubRewrite.isSupported()) {
      await this.epubRewrite.renamePublicDocument(
        this.publicEpubFolder,
        resolved,
        nextFilename,
      );
    } else {
      await this.epubStore.renameEpub(resolved, nextFilename);
      await this.scanPublicEpub(nextFilename);
    }

    await this.movePersistedPreviewAsset(resolved, nextFilename);
    const cached = this.previewCache.get(resolved);
    this.previewCache.delete(resolved);
    if (cached) {
      this.previewCache.set(nextFilename, cached);
    }

    const previousRecord = index.records.find(
      (record) => record.filename === resolved,
    );
    const uri = await this.epubStore.getUriOrThrow(nextFilename).catch(() => null);
    const nextRecord: EpubLibraryRecord = {
      ...(previousRecord ?? this.createLegacyRecord(resolved)),
      filename: nextFilename,
      title: this.titleFromFilename(nextFilename),
      uri,
    };
    const replaced = index.records.map((record) =>
      record.filename === resolved ? nextRecord : record,
    );
    const nextRecords = previousRecord
      ? replaced
      : [...replaced, nextRecord];
    await this.writeLibraryIndex({ schemaVersion: 1, records: nextRecords });
    return nextFilename;
  }

  async shareByFilename(filename: string): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    const uri = await this.epubStore.getUriOrThrow(resolved);
    await this.fileKit.share(
      {
        uri,
        filename: resolved,
        mimeType: 'application/epub+zip',
      },
      {
        title: resolved,
        text: 'EPUB Merger & Splitter',
        dialogTitle: 'Share EPUB',
      },
    );
  }

  async openByFilename(filename: string): Promise<void> {
    const resolved = this.ensureEpubFilename(filename);
    const uri = await this.epubStore.getUriOrThrow(resolved);

    if (!this.epubRewrite.isSupported()) {
      await this.fileKit.share(
        {
          uri,
          filename: resolved,
          mimeType: 'application/epub+zip',
        },
        {
          title: resolved,
          text: 'EPUB Merger & Splitter',
          dialogTitle: 'Open EPUB',
        },
      );
      return;
    }

    await this.epubRewrite.openExternalFile({
      inputPath: uri,
      mimeType: 'application/epub+zip',
      chooserTitle: 'Open EPUB',
    });
  }

  async getFileSizeBytes(filename: string): Promise<number | null> {
    try {
      return this.epubStore.getFileSizeOrThrow(this.ensureEpubFilename(filename));
    } catch {
      return null;
    }
  }

  async resolvePreviewAsset(
    filename: string,
    opts?: { forceRefresh?: boolean },
  ): Promise<LibraryPreviewAsset> {
    const cacheKey = this.ensureEpubFilename(filename);
    if (!opts?.forceRefresh) {
      const cached = this.previewCache.get(cacheKey);
      if (cached) {
        if (cached.src) {
          return cached;
        }
        this.previewCache.delete(cacheKey);
      }

    }

    const persisted = await this.readPersistedPreviewAsset(cacheKey);
    if (persisted) {
      this.previewCache.set(cacheKey, persisted);
      return persisted;
    }

    const resolved = await this.refreshPreviewAsset(cacheKey);
    if (!resolved) {
      return { src: '', isDithered: false };
    }
    return resolved;
  }

  private async extractCoverFile(filename: string): Promise<File | null> {
    if (this.epubRewrite.isSupported()) {
      const uri = await this.epubStore.getUriOrThrow(filename);
      const extracted = await this.epubRewrite.extractCoverAssetFile({
        epubPath: uri,
        epubName: filename,
        maxBytes: 30 * 1024 * 1024,
      });
      return extracted.file;
    }

    if (!this.webEpubCover) {
      return null;
    }

    const bytes = await this.epubStore.readBytes(filename);
    const epubBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const epubFile = new File([epubBuffer], filename, {
      type: 'application/epub+zip',
    });
    return this.webEpubCover.extractCover(epubFile);
  }

  private async refreshPreviewAsset(
    filename: string,
  ): Promise<LibraryPreviewAsset | null> {
    const coverFile = await this.extractCoverFile(filename);
    if (!coverFile) {
      return null;
    }

    const asset = await this.persistPreviewAsset(filename, coverFile);
    this.previewCache.set(filename, asset);
    return asset;
  }

  private previewThumbPath(filename: string): string {
    return `${this.previewThumbFolder}/${this.fileKit.makeSafeFilename(
      filename,
      'json',
    )}`;
  }

  private async readPersistedPreviewAsset(
    filename: string,
  ): Promise<LibraryPreviewAsset | null> {
    const path = this.previewThumbPath(filename);
    try {
      const exists = await this.fileKit.exists({
        dir: 'Data',
        path,
      });
      if (!exists) {
        return null;
      }

      const raw = await this.fileKit.readBytes({
        dir: 'Data',
        path,
      });
      const text = new TextDecoder().decode(raw);
      const parsed = JSON.parse(text) as Partial<PersistedPreviewAsset>;
      if (
        !parsed ||
        typeof parsed.mimeType !== 'string' ||
        typeof parsed.dataBase64 !== 'string' ||
        !parsed.dataBase64.trim()
      ) {
        return null;
      }

      return {
        src: `data:${parsed.mimeType};base64,${parsed.dataBase64}`,
        isDithered: !!parsed.isDithered,
      };
    } catch {
      return null;
    }
  }

  private async persistPreviewAsset(
    filename: string,
    coverFile: File,
  ): Promise<LibraryPreviewAsset> {
    const bytes = new Uint8Array(await coverFile.arrayBuffer());
    const mimeType = coverFile.type || 'image/jpeg';
    const dataBase64 = this.fileKit.toBase64(bytes);
    const payload: PersistedPreviewAsset = {
      mimeType,
      dataBase64,
      isDithered: false,
    };

    await this.fileKit.writeBytes({
      dir: 'Data',
      path: this.previewThumbPath(filename),
      bytes: new TextEncoder().encode(JSON.stringify(payload)),
      mimeType: 'application/json',
    });

    return {
      src: `data:${mimeType};base64,${dataBase64}`,
      isDithered: false,
    };
  }

  private async deletePersistedPreviewAsset(filename: string): Promise<void> {
    try {
      await this.fileKit.delete({
        dir: 'Data',
        path: this.previewThumbPath(filename),
      });
    } catch {
      // best effort
    }
  }

  private async movePersistedPreviewAsset(
    fromFilename: string,
    toFilename: string,
  ): Promise<void> {
    const fromPath = this.previewThumbPath(fromFilename);
    const toPath = this.previewThumbPath(toFilename);
    try {
      if (!(await this.fileKit.exists({ dir: 'Data', path: fromPath }))) {
        return;
      }
      const bytes = await this.fileKit.readBytes({ dir: 'Data', path: fromPath });
      await this.fileKit.writeBytes({
        dir: 'Data',
        path: toPath,
        bytes,
        mimeType: 'application/json',
      });
      await this.fileKit.delete({ dir: 'Data', path: fromPath });
    } catch {
      // The preview can be regenerated from the renamed EPUB.
    }
  }

  private async readExportBytes(sourceUri: string): Promise<Uint8Array> {
    const fetchUrl = this.toFetchUrl(sourceUri);
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to read export output: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  private async listPublicEpubFilenames(): Promise<string[]> {
    if (this.epubRewrite.isSupported()) {
      return (await this.epubRewrite.listPublicDocuments(this.publicEpubFolder, '.epub'))
        .map((file) => file.name)
        .sort((left, right) => left.localeCompare(right));
    }
    return this.epubStore.listEpubs();
  }

  private async scanPublicEpub(filename: string): Promise<void> {
    if (!this.epubRewrite.isSupported()) {
      return;
    }

    try {
      await this.epubRewrite.scanFile({
        path: await this.epubStore.nativePathFor(filename),
        mimeType: 'application/epub+zip',
      });
    } catch {
      return;
    }
  }

  private toFetchUrl(sourceUri: string): string {
    if (!sourceUri) {
      return sourceUri;
    }

    if (
      sourceUri.startsWith('blob:') ||
      sourceUri.startsWith('http:') ||
      sourceUri.startsWith('https:')
    ) {
      return sourceUri;
    }

    const nativePath = this.toNativePath(sourceUri);
    return Capacitor.convertFileSrc(nativePath);
  }

  private toNativePath(uriOrPath: string): string {
    if (uriOrPath.startsWith('file://')) {
      return decodeURIComponent(uriOrPath.replace(/^file:\/\//, ''));
    }
    return uriOrPath;
  }

  private ensureEpubFilename(name: string): string {
    return this.fileKit.makeSafeFilename(name || 'book', 'epub');
  }

  private resolveUniqueFilename(
    requestedName: string,
    usedNames: ReadonlySet<string>,
  ): string {
    const filename = this.ensureEpubFilename(requestedName);
    if (!usedNames.has(filename)) {
      return filename;
    }
    const baseName = filename.replace(/\.epub$/i, '');
    let index = 1;
    let candidate = filename;
    while (usedNames.has(candidate)) {
      candidate = baseName + ' (' + index + ').epub';
      index += 1;
    }
    return candidate;
  }

  private async readLibraryIndex(): Promise<EpubLibraryIndex> {
    try {
      const bytes = await this.fileKit.readBytes({
        dir: 'Data',
        path: this.libraryIndexPath,
      });
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<EpubLibraryIndex>;
      if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.records)) {
        return { schemaVersion: 1, records: [] };
      }
      return {
        schemaVersion: 1,
        records: parsed.records.filter((record) => this.isValidRecord(record)),
      };
    } catch {
      return { schemaVersion: 1, records: [] };
    }
  }

  private async writeLibraryIndex(index: EpubLibraryIndex): Promise<void> {
    await this.fileKit.writeBytes({
      dir: 'Data',
      path: this.libraryIndexPath,
      bytes: new TextEncoder().encode(JSON.stringify(index)),
      mimeType: 'application/json',
    });
  }

  private isValidRecord(value: unknown): value is EpubLibraryRecord {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const record = value as Partial<EpubLibraryRecord>;
    return (
      typeof record.id === 'string' &&
      typeof record.filename === 'string' &&
      typeof record.title === 'string' &&
      typeof record.sizeBytes === 'number' &&
      typeof record.createdAt === 'string' &&
      (record.operation === 'merge' || record.operation === 'split') &&
      typeof record.operationId === 'string' &&
      typeof record.partIndex === 'number'
    );
  }

  private createLegacyRecord(filename: string): EpubLibraryRecord {
    return {
      id: 'legacy:' + filename,
      filename,
      title: this.titleFromFilename(filename),
      uri: null,
      sizeBytes: 0,
      createdAt: new Date(0).toISOString(),
      operation: 'merge',
      operationId: 'legacy:' + filename,
      partIndex: 0,
    };
  }

  private titleFromFilename(filename: string): string {
    return filename.replace(/\.epub$/i, '').trim() || 'EPUB';
  }

  private compareRecords(left: EpubLibraryRecord, right: EpubLibraryRecord): number {
    if (left.operationId === right.operationId) {
      return left.partIndex - right.partIndex;
    }
    const dateOrder = right.createdAt.localeCompare(left.createdAt);
    return dateOrder || left.filename.localeCompare(right.filename);
  }

}
