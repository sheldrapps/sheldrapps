import { TestBed } from '@angular/core/testing';
import { Directory } from '@capacitor/filesystem';
import { TranslateService } from '@ngx-translate/core';
import {
  FileKitService,
  providePdfFileKit,
  PUBLIC_FILESYSTEM,
  WebPdfCoverService,
  WEB_PDF_COVER_SERVICE_TOKEN,
  type PublicFilesystem,
} from '@sheldrapps/file-kit/pdf';

import { FileService } from './file.service';
import { PdfRewriteService } from './pdf-rewrite.service';

describe('FileService', () => {
  let service: FileService;
  let webPdfCover: jasmine.SpyObj<WebPdfCoverService>;

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
    webPdfCover = jasmine.createSpyObj<WebPdfCoverService>(
      'WebPdfCoverService',
      ['triggerDownload'],
    );

    TestBed.configureTestingModule({
      providers: [
        ...providePdfFileKit({ enableWebDevAdapters: false }),
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
            validatePdf: jasmine.createSpy('validatePdf').and.returnValue({
              valid: true,
            }),
            fromBase64: jasmine.createSpy('fromBase64').and.returnValue(
              new Uint8Array(),
            ),
            toBase64: jasmine.createSpy('toBase64').and.returnValue(''),
          },
        },
        {
          provide: PUBLIC_FILESYSTEM,
          useValue: createPublicFilesystemFixture(),
        },
        {
          provide: PdfRewriteService,
          useValue: {
            isSupported: () => false,
          },
        },
        { provide: WEB_PDF_COVER_SERVICE_TOKEN, useValue: webPdfCover },
      ],
    });
    service = TestBed.inject(FileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('writes, lists, and resolves the public PDF through Documents', async () => {
    const store = (service as any).pdfStore;

    await store.writePdf('book.pdf', new Uint8Array([1, 2, 3]));

    expect(await store.listPdfs()).toEqual(['book.pdf']);
    expect(await store.getUriOrThrow('book.pdf')).toBe(
      'content://DOCUMENTS:pdfcovermaker/book.pdf',
    );
  });

  it('saveGeneratedPdf should persist internally on web and not trigger download', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const coverFile = new File([new Uint8Array([7, 8, 9])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'book.pdf',
    );
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    fileKit.writeBytes.and.resolveTo();
    fileKit.getUri.and.resolveTo('app://library/book.pdf');
    const persistAssetsSpy = spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'pdfcovermakerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });

    const result = await service.saveGeneratedPdf({
      bytes,
      filename: 'book.pdf',
      coverFileForThumb: coverFile,
    });

    expect(getUniqueSpy).toHaveBeenCalledWith('book.pdf');
    expect(fileKit.writeBytes).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'pdfcovermaker/book.pdf',
      bytes,
      mimeType: 'application/pdf',
    });
    expect(fileKit.getUri).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'pdfcovermaker/book.pdf',
    });
    expect(persistAssetsSpy).toHaveBeenCalledWith(coverFile, 'book.pdf');
    expect(webPdfCover.triggerDownload).not.toHaveBeenCalled();
    expect(result).toEqual({
      path: 'pdfcovermaker/book.pdf',
      uri: 'app://library/book.pdf',
      filename: 'book.pdf',
      thumbPath: 'pdfcovermakerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });
  });

  it('saveGeneratedPdf should generate a unique filename when overwriteExisting is not set', async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const coverFile = new File([new Uint8Array([1, 2, 3])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'book (1).pdf',
    );
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    fileKit.writeBytes.and.resolveTo();
    fileKit.getUri.and.resolveTo('app://library/book-1.pdf');
    const persistAssetsSpy = spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'pdfcovermakerThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });
    spyOn<any>(service, 'cacheResolvedCoverMetadata');

    const result = await service.saveGeneratedPdf({
      bytes,
      filename: 'book.pdf',
      coverFileForThumb: coverFile,
    });

    expect(getUniqueSpy).toHaveBeenCalledWith('book.pdf');
    expect(fileKit.writeBytes).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'pdfcovermaker/book (1).pdf',
      bytes,
      mimeType: 'application/pdf',
    });
    expect(fileKit.getUri).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'pdfcovermaker/book (1).pdf',
    });
    expect(persistAssetsSpy).toHaveBeenCalledWith(coverFile, 'book (1).pdf');
    expect(result).toEqual({
      path: 'pdfcovermaker/book (1).pdf',
      uri: 'app://library/book-1.pdf',
      filename: 'book (1).pdf',
      thumbPath: 'pdfcovermakerThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });
  });

  it('saveGeneratedPdf should reuse filename when overwriteExisting is set', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const coverFile = new File([new Uint8Array([7, 8, 9])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const pdfRewrite = TestBed.inject(PdfRewriteService);
    spyOn(pdfRewrite, 'isSupported').and.returnValue(true);
    spyOn<any>(service, 'applyCoverMetadataToPdfBytes').and.resolveTo(bytes);
    const writePdfSpy = spyOn<any>(service, 'writpdflicPdf').and.resolveTo();
    const getUriSpy = spyOn<any>(service, 'getPublicPdfFileUriOrThrow').and.resolveTo(
      'app://library/book.pdf',
    );
    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'should-not-be-used.pdf',
    );
    spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'pdfcovermakerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });
    spyOn<any>(service, 'cacheResolvedCoverMetadata');

    const result = await service.saveGeneratedPdf({
      bytes,
      filename: 'book.pdf',
      coverFileForThumb: coverFile,
      overwriteExisting: true,
    });

    expect(getUniqueSpy).not.toHaveBeenCalled();
    expect(writePdfSpy).toHaveBeenCalledWith('book.pdf', bytes);
    expect(getUriSpy).toHaveBeenCalledWith('book.pdf');
    expect(result.filename).toBe('book.pdf');
  });

  it('reserves a private absolute path for native rewrite output', async () => {
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo('book.pdf');
    fileKit.writeBytes.and.resolveTo();
    fileKit.getUri.and.resolveTo(
      'file:///data/user/0/com.sheldrapps.pdfcovermaker/files/pdfcovermakerRewrite/rewrite-book.pdf',
    );

    const target = await service.reserveNativeDocumentOutput('book.pdf');

    expect(target.rewritePath).toMatch(/^pdfcovermakerRewrite\//);
    expect(target.rewriteNativePath).toContain(
      '/files/pdfcovermakerRewrite/',
    );
    expect(fileKit.writeBytes).toHaveBeenCalledWith(
      jasmine.objectContaining({
        dir: 'Data',
        path: target.rewritePath,
        bytes: jasmine.any(Uint8Array),
        mimeType: 'application/pdf',
      }),
    );
  });

  it('validatePdf proxies validation errors from file-kit', () => {
    const fileKit = TestBed.inject(FileKitService) as jasmine.SpyObj<FileKitService>;
    fileKit.validatePdf.and.returnValue({
      valid: false,
      errorKey: 'PDF_ERROR_TYPE',
    });

    const result = service.validatePdf(new File([], 'bad.txt', { type: 'text/plain' }), 50);
    expect(result).toEqual({ valid: false, errorKey: 'PDF_ERROR_TYPE' });
  });

  it('loadGeneratedPdfByFilename rebuilds saved pdf as File', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    spyOn<any>(service, 'readPublicPdfBytes').and.resolveTo(bytes);

    const file = await service.loadGeneratedPdfByFilename('book.pdf');

    expect(file).toEqual(jasmine.any(File));
    expect(file?.name).toBe('book.pdf');
    expect(file?.type).toBe('application/pdf');
    expect(Array.from(new Uint8Array(await file!.arrayBuffer()))).toEqual(
      Array.from(bytes),
    );
  });
});
