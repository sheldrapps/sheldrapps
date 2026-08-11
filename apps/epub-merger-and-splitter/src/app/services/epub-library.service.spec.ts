import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { Directory } from '@capacitor/filesystem';
import {
  EPUB_PUBLIC_FILESYSTEM,
  EpubRewriteService,
  type EpubPublicFilesystem,
  FileKitService,
  WEB_EPUB_COVER_SERVICE_TOKEN,
} from '@sheldrapps/file-kit';

import { EpubLibraryService } from './epub-library.service';

describe('EpubLibraryService', () => {
  let service: EpubLibraryService;
  let epubRewrite: jasmine.SpyObj<EpubRewriteService>;
  let fileKit: jasmine.SpyObj<FileKitService>;
  let filesystem: jasmine.SpyObj<EpubPublicFilesystem>;
  let publicFiles: Set<string>;

  beforeEach(() => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    publicFiles = new Set();
    filesystem = jasmine.createSpyObj<EpubPublicFilesystem>('Filesystem', [
      'mkdir',
      'readdir',
      'writeFile',
      'getUri',
      'deleteFile',
      'rename',
      'readFile',
      'stat',
    ]);
    filesystem.mkdir.and.resolveTo({} as never);
    filesystem.readdir.and.callFake(() =>
      Promise.resolve({ files: [...publicFiles] } as never),
    );
    filesystem.writeFile.and.callFake((options) => {
      if (
        options.directory === Directory.Documents &&
        options.path.startsWith('EpubMergerAndSplitter/')
      ) {
        publicFiles.add(options.path.split('/').pop() as string);
      }
      return Promise.resolve({} as never);
    });
    filesystem.getUri.and.callFake((options) =>
      Promise.resolve({
        uri: `file:///storage/emulated/0/Documents/${options.path}`,
      } as never),
    );
    filesystem.stat.and.callFake((options) => {
      const filename = options.path.split('/').pop();
      if (
        options.directory === Directory.Documents &&
        filename &&
        publicFiles.has(filename)
      ) {
        return Promise.resolve({ size: 3 } as never);
      }
      return Promise.reject(new Error('file missing'));
    });
    filesystem.deleteFile.and.resolveTo(undefined);
    filesystem.rename.and.resolveTo(undefined);
    filesystem.readFile.and.rejectWith(new Error('file missing'));

    epubRewrite = jasmine.createSpyObj<EpubRewriteService>(
      'EpubRewriteService',
      [
        'isSupported',
        'scanFile',
        'extractCoverAssetFile',
        'listPublicDocuments',
        'publishPublicDocument',
        'deletePublicDocument',
        'renamePublicDocument',
      ],
    );
    fileKit = jasmine.createSpyObj<FileKitService>('FileKitService', [
      'fromBase64',
      'toBase64',
      'readBytes',
      'writeBytes',
      'delete',
      'exists',
      'makeSafeFilename',
    ]);

    TestBed.configureTestingModule({
      providers: [
        EpubLibraryService,
        { provide: EpubRewriteService, useValue: epubRewrite },
        { provide: FileKitService, useValue: fileKit },
        { provide: EPUB_PUBLIC_FILESYSTEM, useValue: filesystem },
        { provide: WEB_EPUB_COVER_SERVICE_TOKEN, useValue: null },
      ],
    });

    service = TestBed.inject(EpubLibraryService);
  });

  it('saves, registers, and lists the public EPUB from Directory.Documents', async () => {
    epubRewrite.isSupported.and.returnValue(true);
    epubRewrite.listPublicDocuments.and.returnValues(
      Promise.resolve([]),
      Promise.resolve([
        {
          name: 'merged.epub',
          uri: 'content://media/external/file/42',
          size: 3,
        },
      ]),
    );
    epubRewrite.publishPublicDocument.and.resolveTo({
      uri: 'content://media/external/file/42',
      filename: 'merged.epub',
      size: 3,
      copiedBytes: 3,
    });
    publicFiles.add('merged.epub');
    epubRewrite.extractCoverAssetFile.and.resolveTo({
      file: new File(['cover'], 'cover.jpg', { type: 'image/jpeg' }),
    } as never);
    fileKit.makeSafeFilename.and.callFake((name, extension) =>
      name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`,
    );
    fileKit.toBase64.and.returnValue('Y292ZXI=');
    fileKit.delete.and.resolveTo(undefined);

    let libraryIndex = JSON.stringify({ schemaVersion: 1, records: [] });
    fileKit.readBytes.and.callFake(async ({ path }) => {
      if (path === 'EpubMergerAndSplitter/library-index.json') {
        return new TextEncoder().encode(libraryIndex);
      }

      throw new Error(`missing private file: ${path}`);
    });
    fileKit.writeBytes.and.callFake(async ({ path, bytes }) => {
      if (path === 'EpubMergerAndSplitter/library-index.json') {
        libraryIndex = new TextDecoder().decode(bytes);
      }

      return {
        uri: `file:///data/${path}`,
        mimeType: 'application/json',
        filename: path.split('/').pop() ?? 'file',
        size: bytes.byteLength,
      };
    });

    const saved = await service.saveExportedEpub(
      '/data/user/0/com.sheldrapps.emas/cache/merged.epub',
      'merged.epub',
    );

    expect(epubRewrite.listPublicDocuments).toHaveBeenCalledWith(
      'EpubMergerAndSplitter',
      '.epub',
    );
    expect(epubRewrite.publishPublicDocument).toHaveBeenCalledWith({
      folderName: 'EpubMergerAndSplitter',
      sourcePath: '/data/user/0/com.sheldrapps.emas/cache/merged.epub',
      outputName: 'merged.epub',
      mimeType: 'application/epub+zip',
    });
    expect(filesystem.writeFile).not.toHaveBeenCalled();
    expect(epubRewrite.scanFile).not.toHaveBeenCalled();
    expect(saved).toEqual(
      jasmine.objectContaining({
        filename: 'merged.epub',
        uri: 'content://media/external/file/42',
        sizeBytes: 3,
        operation: 'merge',
        partIndex: 0,
        thumbnailUri: 'data:image/jpeg;base64,Y292ZXI=',
      }),
    );

    const registered = JSON.parse(libraryIndex).records;
    expect(registered).toEqual([
      jasmine.objectContaining({ filename: 'merged.epub', sizeBytes: 3 }),
    ]);
    expect(await service.listEpubs()).toEqual(['merged.epub']);
  });

  it('does not cache a transient missing-cover result', async () => {
    epubRewrite.isSupported.and.returnValue(true);
    publicFiles.add('book.epub');
    epubRewrite.extractCoverAssetFile.and.rejectWith(new Error('not ready'));
    fileKit.exists.and.resolveTo(false);

    const first = await service.resolvePreviewAsset('book.epub');

    epubRewrite.extractCoverAssetFile.and.resolveTo({
      file: new File(['cover'], 'cover.jpg', { type: 'image/jpeg' }),
    } as never);
    fileKit.toBase64.and.returnValue('Y292ZXI=');

    const second = await service.resolvePreviewAsset('book.epub');

    expect(first.src).toBe('');
    expect(second.src).toBe('data:image/jpeg;base64,Y292ZXI=');
    expect(epubRewrite.extractCoverAssetFile).toHaveBeenCalledTimes(2);
  });

  it('renames the public EPUB and updates its library record', async () => {
    epubRewrite.isSupported.and.returnValue(true);
    epubRewrite.listPublicDocuments.and.resolveTo([
      {
        name: 'old.epub',
        uri: 'content://media/external/file/42',
        size: 3,
      },
    ]);
    epubRewrite.renamePublicDocument.and.resolveTo();
    fileKit.makeSafeFilename.and.callFake((name, extension) =>
      name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`,
    );
    fileKit.exists.and.callFake(async ({ path }) =>
      path === 'EpubMergerAndSplitter/library-index.json',
    );
    fileKit.readBytes.and.resolveTo(
      new TextEncoder().encode(
        JSON.stringify({
          schemaVersion: 1,
          records: [
            {
              id: 'record-1',
              filename: 'old.epub',
              title: 'Old',
              uri: 'content://media/external/file/42',
              sizeBytes: 3,
              createdAt: '2026-01-01T00:00:00.000Z',
              operation: 'merge',
              operationId: 'operation-1',
              partIndex: 0,
            },
          ],
        }),
      ),
    );
    fileKit.writeBytes.and.resolveTo({
      uri: 'file:///data/library-index.json',
      mimeType: 'application/json',
      filename: 'library-index.json',
      size: 0,
    });

    const renamed = await service.renameByFilename('old.epub', 'new');

    expect(renamed).toBe('new.epub');
    expect(epubRewrite.renamePublicDocument).toHaveBeenCalledWith(
      'EpubMergerAndSplitter',
      'old.epub',
      'new.epub',
    );
    expect(fileKit.writeBytes).toHaveBeenCalledWith(
      jasmine.objectContaining({ path: 'EpubMergerAndSplitter/library-index.json' }),
    );
  });
});
