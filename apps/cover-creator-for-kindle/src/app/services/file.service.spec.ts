import { TestBed } from '@angular/core/testing';
import { Directory } from '@capacitor/filesystem';
import { TranslateService } from '@ngx-translate/core';
import {
  provideFileKit,
  PUBLIC_FILESYSTEM,
  type PublicFilesystem,
} from '@sheldrapps/file-kit';

import { FileService } from './file.service.js';

describe('FileService', () => {
  let service: FileService;

  const createPublicFilesystemFixture = (): PublicFilesystem => {
    type PathOptions = Parameters<PublicFilesystem['stat']>[0];
    type ReaddirOptions = Parameters<PublicFilesystem['readdir']>[0];
    type WriteOptions = Parameters<PublicFilesystem['writeFile']>[0];
    type UriOptions = Parameters<PublicFilesystem['getUri']>[0];
    type DeleteOptions = Parameters<PublicFilesystem['deleteFile']>[0];
    type RenameOptions = Parameters<PublicFilesystem['rename']>[0];
    type ReadOptions = Parameters<PublicFilesystem['readFile']>[0];
    const files = new Map<string, string>();
    const keyFor = (options: PathOptions) =>
      `${options.directory ?? 'absolute'}:${options.path}`;

    return {
      mkdir: async () => undefined,
      readdir: async (options: ReaddirOptions) => {
        const prefix = `${keyFor(options)}/`;
        const entries = [...files.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => key.slice(prefix.length).split('/')[0]);
        return { files: [...new Set(entries)].map((name) => ({ name })) };
      },
      writeFile: async (options: WriteOptions) => {
        files.set(keyFor(options), String(options.data));
      },
      getUri: async (options: UriOptions) => ({ uri: `content://${keyFor(options)}` }),
      deleteFile: async (options: DeleteOptions) => {
        files.delete(keyFor(options));
      },
      rename: async (options: RenameOptions) => {
        const fromKey = `${options.directory ?? 'absolute'}:${options.from}`;
        const toKey = `${options.directory ?? 'absolute'}:${options.to}`;
        const data = files.get(fromKey);
        if (data === undefined) throw new Error('File not found');
        files.delete(fromKey);
        files.set(toKey, data);
      },
      readFile: async (options: ReadOptions) => ({ data: files.get(keyFor(options)) ?? '' }),
      stat: async (options: PathOptions) => {
        if (!files.has(keyFor(options))) throw new Error('File not found');
        return { size: 3 };
      },
    } as unknown as PublicFilesystem;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...provideFileKit({ enableWebDevAdapters: false }),
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key },
        },
        {
          provide: PUBLIC_FILESYSTEM,
          useValue: createPublicFilesystemFixture(),
        },
      ],
    });
    service = TestBed.inject(FileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('writes, lists, and resolves the public EPUB through Documents', async () => {
    const store = (service as any).epubStore;

    await store.writeEpub('book.epub', new Uint8Array([1, 2, 3]));

    expect(await store.listEpubs()).toEqual(['book.epub']);
    expect(await store.getUriOrThrow('book.epub')).toBe(
      'content://DOCUMENTS:CoverCreator/book.epub',
    );
  });

  it('saveGeneratedEpub should reuse filename when overwriteExisting is set', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const coverFile = new File([new Uint8Array([7, 8, 9])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const epubRewrite = (service as any).epubRewrite;
    spyOn(epubRewrite, 'isSupported').and.returnValue(true);
    spyOn<any>(service, 'applyCoverMetadataToEpubBytes').and.resolveTo(bytes);
    const writeEpubSpy = spyOn<any>(service, 'writePublicEpub').and.resolveTo();
    const getUriSpy = spyOn<any>(service, 'getPublicEpubFileUriOrThrow').and.resolveTo(
      'app://library/book.epub',
    );
    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'should-not-be-used.epub',
    );
    spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'EPUBCreatorThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });

    const result = await service.saveGeneratedEpub({
      bytes,
      filename: 'book.epub',
      coverFileForThumb: coverFile,
      overwriteExisting: true,
    });

    expect(getUniqueSpy).not.toHaveBeenCalled();
    expect(writeEpubSpy).toHaveBeenCalledWith('book.epub', bytes);
    expect(getUriSpy).toHaveBeenCalledWith('book.epub');
    expect(result.filename).toBe('book.epub');
  });

  it('saveGeneratedEpub should generate a unique filename on web when overwriteExisting is not set', async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const coverFile = new File([new Uint8Array([1, 2, 3])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const epubRewrite = (service as any).epubRewrite;
    spyOn(epubRewrite, 'isSupported').and.returnValue(false);
    const fileKit = (service as any).fileKit;
    const writeBytesSpy = spyOn(fileKit, 'writeBytes').and.resolveTo();
    const getUriSpy = spyOn(fileKit, 'getUri').and.resolveTo('app://library/book-1.epub');
    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'book (1).epub',
    );
    const persistAssetsSpy = spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'EPUBCreatorThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });

    const result = await service.saveGeneratedEpub({
      bytes,
      filename: 'book.epub',
      coverFileForThumb: coverFile,
    });

    expect(getUniqueSpy).toHaveBeenCalledWith('book.epub');
    expect(writeBytesSpy).toHaveBeenCalled();
    expect(getUriSpy).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'CoverCreator/book (1).epub',
    });
    expect(persistAssetsSpy).toHaveBeenCalledWith(coverFile, 'book (1).epub');
    expect(result).toEqual({
      path: 'CoverCreator/book (1).epub',
      uri: 'app://library/book-1.epub',
      filename: 'book (1).epub',
      thumbPath: 'EPUBCreatorThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });
  });

  it('saveGeneratedEpub should generate a unique filename when rewrite is supported', async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const coverFile = new File([new Uint8Array([1, 2, 3])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const epubRewrite = (service as any).epubRewrite;
    spyOn(epubRewrite, 'isSupported').and.returnValue(true);
    spyOn<any>(service, 'applyCoverMetadataToEpubBytes').and.resolveTo(bytes);
    const writeEpubSpy = spyOn<any>(service, 'writePublicEpub').and.resolveTo();
    const getUriSpy = spyOn<any>(service, 'getPublicEpubFileUriOrThrow').and.resolveTo(
      'app://library/book-1.epub',
    );
    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'book (1).epub',
    );
    spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'EPUBCreatorThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });

    const result = await service.saveGeneratedEpub({
      bytes,
      filename: 'book.epub',
      coverFileForThumb: coverFile,
    });

    expect(getUniqueSpy).toHaveBeenCalledWith('book.epub');
    expect(writeEpubSpy).toHaveBeenCalledWith('book (1).epub', bytes);
    expect(getUriSpy).toHaveBeenCalledWith('book (1).epub');
    expect(result.filename).toBe('book (1).epub');
  });
});
