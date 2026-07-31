import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import {
  FileKitService,
  PUBLIC_FILESYSTEM,
  WebEpubCoverService,
  type PublicFilesystem,
} from '@sheldrapps/file-kit';

import { FileService } from './file.service';
import { EpubRewriteService } from './epub-rewrite.service';

describe('FileService', () => {
  let service: FileService;
  let webEpubCover: jasmine.SpyObj<WebEpubCoverService>;

  const createPublicFilesystemFixture = (): PublicFilesystem => {
    type PathOptions = Parameters<PublicFilesystem['stat']>[0];
    type ReaddirOptions = Parameters<PublicFilesystem['readdir']>[0];
    type WriteOptions = Parameters<PublicFilesystem['writeFile']>[0];
    type UriOptions = Parameters<PublicFilesystem['getUri']>[0];
    const files = new Map<string, string>();
    const keyFor = (options: PathOptions) =>
      `${options.directory ?? 'absolute'}:${options.path}`;

    return {
      mkdir: async () => undefined,
      readdir: async (options: ReaddirOptions) => {
        const prefix = `${keyFor(options)}/`;
        const names = [...files.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => key.slice(prefix.length).split('/')[0]);
        return { files: [...new Set(names)].map((name) => ({ name })) };
      },
      writeFile: async (options: WriteOptions) => {
        files.set(keyFor(options), String(options.data));
      },
      getUri: async (options: UriOptions) => ({
        uri: `content://${keyFor(options)}`,
      }),
      deleteFile: async () => undefined,
      rename: async () => undefined,
      readFile: async () => ({ data: '' }),
      stat: async (options: PathOptions) => {
        if (!files.has(keyFor(options))) throw new Error('File not found');
        return { size: 3 };
      },
    } as unknown as PublicFilesystem;
  };

  beforeEach(() => {
    webEpubCover = jasmine.createSpyObj<WebEpubCoverService>(
      'WebEpubCoverService',
      ['triggerDownload'],
    );

    TestBed.configureTestingModule({
      providers: [
        FileService,
        {
          provide: TranslateService,
          useValue: {
            currentLang: 'en',
            defaultLang: 'en',
            instant: (key: string) => key,
          },
        },
        {
          provide: FileKitService,
          useValue: {
            writeBytes: jasmine.createSpy('writeBytes'),
            getUri: jasmine.createSpy('getUri'),
            readBytes: jasmine.createSpy('readBytes'),
            delete: jasmine.createSpy('delete'),
            exists: jasmine.createSpy('exists'),
            share: jasmine.createSpy('share'),
            fromBase64: jasmine.createSpy('fromBase64').and.returnValue(
              new Uint8Array(),
            ),
            toBase64: jasmine.createSpy('toBase64').and.returnValue(''),
          },
        },
        {
          provide: EpubRewriteService,
          useValue: {
            isSupported: () => false,
            ensurePublicExportFolder: jasmine.createSpy('ensurePublicExportFolder'),
            publishPublicDocument: jasmine.createSpy('publishPublicDocument'),
            scanFile: jasmine.createSpy('scanFile').and.resolveTo(),
          },
        },
        {
          provide: PUBLIC_FILESYSTEM,
          useValue: createPublicFilesystemFixture(),
        },
        { provide: WebEpubCoverService, useValue: webEpubCover },
      ],
    });
    service = TestBed.inject(FileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('saveGeneratedEpub should persist internally on web and not trigger download', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const coverFile = new File([new Uint8Array([7, 8, 9])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'book.epub',
    );
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    fileKit.writeBytes.and.resolveTo();
    fileKit.getUri.and.resolveTo('app://library/book.epub');
    const persistAssetsSpy = spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'EPUBCoverChangerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });

    const result = await service.saveGeneratedEpub({
      bytes,
      filename: 'book.epub',
      coverFileForThumb: coverFile,
    });

    expect(getUniqueSpy).toHaveBeenCalledWith('book.epub');
    expect(fileKit.writeBytes).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'EPUBCoverChanger/book.epub',
      bytes,
      mimeType: 'application/epub+zip',
    });
    expect(fileKit.getUri).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'EPUBCoverChanger/book.epub',
    });
    expect(persistAssetsSpy).toHaveBeenCalledWith(coverFile, 'book.epub');
    expect(webEpubCover.triggerDownload).not.toHaveBeenCalled();
    expect(result).toEqual({
      path: 'EPUBCoverChanger/book.epub',
      uri: 'app://library/book.epub',
      filename: 'book.epub',
      thumbPath: 'EPUBCoverChangerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });
  });

  it('saveGeneratedEpub should generate a unique filename when overwriteExisting is not set', async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const coverFile = new File([new Uint8Array([1, 2, 3])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'book (1).epub',
    );
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    fileKit.writeBytes.and.resolveTo();
    fileKit.getUri.and.resolveTo('app://library/book-1.epub');
    const persistAssetsSpy = spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'EPUBCoverChangerThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });
    spyOn<any>(service, 'cacheResolvedCoverMetadata');

    const result = await service.saveGeneratedEpub({
      bytes,
      filename: 'book.epub',
      coverFileForThumb: coverFile,
    });

    expect(getUniqueSpy).toHaveBeenCalledWith('book.epub');
    expect(fileKit.writeBytes).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'EPUBCoverChanger/book (1).epub',
      bytes,
      mimeType: 'application/epub+zip',
    });
    expect(fileKit.getUri).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'EPUBCoverChanger/book (1).epub',
    });
    expect(persistAssetsSpy).toHaveBeenCalledWith(coverFile, 'book (1).epub');
    expect(result).toEqual({
      path: 'EPUBCoverChanger/book (1).epub',
      uri: 'app://library/book-1.epub',
      filename: 'book (1).epub',
      thumbPath: 'EPUBCoverChangerThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });
  });

  it('saveGeneratedEpub should reuse filename when overwriteExisting is set', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const coverFile = new File([new Uint8Array([7, 8, 9])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const epubRewrite = TestBed.inject(EpubRewriteService);
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
      thumbPath: 'EPUBCoverChangerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });
    spyOn<any>(service, 'cacheResolvedCoverMetadata');

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

  it('publishes Android writes through SAF instead of the MediaStore scanner', async () => {
    const epubRewrite = TestBed.inject(EpubRewriteService);
    spyOn(epubRewrite, 'isSupported').and.returnValue(true);
    const ensureFolderSpy = epubRewrite.ensurePublicExportFolder as jasmine.Spy;
    const publishSpy = epubRewrite.publishPublicDocument as jasmine.Spy;
    ensureFolderSpy.and.resolveTo('content://documents/EPUBCoverChanger');
    publishSpy.and.resolveTo({
      uri: 'content://documents/book.epub',
      filename: 'book.epub',
      size: 3,
      copiedBytes: 3,
    });
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    fileKit.writeBytes.and.resolveTo();
    fileKit.getUri.and.resolveTo('file:///data/user/0/app/files/staging.epub');
    fileKit.delete.and.resolveTo();

    await (service as any).writePublicEpub(
      'book.epub',
      new Uint8Array([1, 2, 3]),
    );

    expect(ensureFolderSpy).toHaveBeenCalledWith('EPUBCoverChanger');
    expect(publishSpy).toHaveBeenCalledWith(jasmine.objectContaining({
      folderName: 'EPUBCoverChanger',
      sourcePath: 'file:///data/user/0/app/files/staging.epub',
      outputName: 'book.epub',
      mimeType: 'application/epub+zip',
    }));
  });

  it('reserves a private data path for native rewrite and keeps the public target separate', async () => {
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    spyOn<any>(service, 'ensurePublicDocumentsEpubFolderReady').and.resolveTo();
    spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo('book.epub');
    fileKit.writeBytes.and.resolveTo();
    fileKit.getUri.and.resolveTo(
      'file:///data/user/0/com.sheldrapps.epubcoverchanger/files/EPUBCoverChangerRewrite/book.epub',
    );

    const target = await service.reserveNativeDocumentOutput('book.epub');

    expect(target.rewritePath).toMatch(/^EPUBCoverChangerRewrite\//);
    expect(target.rewriteNativePath).toContain(
      '/files/EPUBCoverChangerRewrite/',
    );
    expect(fileKit.writeBytes).toHaveBeenCalledWith(
      jasmine.objectContaining({
        dir: 'Data',
        path: target.rewritePath,
        bytes: jasmine.any(Uint8Array),
        mimeType: 'application/epub+zip',
      }),
    );
  });

  it('commits the private rewrite result through the public EPUB store on web', async () => {
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    const bytes = new Uint8Array([1, 2, 3]);
    const target = {
      filename: 'book.epub',
      relativePath: 'EPUBCoverChanger/book.epub',
      rewritePath: 'EPUBCoverChangerRewrite/rewrite-book.epub',
      rewriteNativePath:
        'file:///data/user/0/com.sheldrapps.epubcoverchanger/files/rewrite-book.epub',
    };
    fileKit.readBytes.and.resolveTo(bytes);
    const writePublicSpy = spyOn<any>(service, 'writePublicEpub').and.resolveTo();
    const getUriSpy = spyOn<any>(service, 'getPublicEpubFileUriOrThrow').and.resolveTo(
      'content://public/book.epub',
    );

    const result = await service.commitNativeDocumentOutput(target);

    expect(fileKit.readBytes).toHaveBeenCalledWith({
      dir: 'Data',
      path: target.rewritePath,
    });
    expect(writePublicSpy).toHaveBeenCalledWith(target.filename, bytes);
    expect(getUriSpy).toHaveBeenCalledWith(target.filename);
    expect(result).toEqual({ size: bytes.byteLength, uri: 'content://public/book.epub' });
  });

  it('publishes native rewrite output without reading it into TypeScript memory', async () => {
    const epubRewrite = TestBed.inject(EpubRewriteService) as jasmine.SpyObj<EpubRewriteService>;
    spyOn(epubRewrite, 'isSupported').and.returnValue(true);
    epubRewrite.publishPublicDocument.and.resolveTo({
      uri: 'content://documents/book.epub',
      filename: 'book.epub',
      size: 2_147_483_648,
      copiedBytes: 2_147_483_648,
    });
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    const target = {
      filename: 'book.epub',
      relativePath: 'EPUBCoverChanger/book.epub',
      rewritePath: 'EPUBCoverChangerRewrite/rewrite-book.epub',
      rewriteNativePath: 'file:///data/user/0/com.sheldrapps.epubcoverchanger/files/rewrite-book.epub',
    };

    const result = await service.commitNativeDocumentOutput(target);

    expect(fileKit.readBytes).not.toHaveBeenCalled();
    expect(epubRewrite.publishPublicDocument).toHaveBeenCalledWith({
      folderName: 'EPUBCoverChanger',
      sourcePath: target.rewriteNativePath,
      outputName: target.filename,
      mimeType: 'application/epub+zip',
    });
    expect(result).toEqual({ uri: 'content://documents/book.epub', size: 2_147_483_648 });
  });
});
