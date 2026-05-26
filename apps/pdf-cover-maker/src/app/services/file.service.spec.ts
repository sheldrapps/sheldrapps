import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import {
  FileKitService,
  WebPdfCoverService,
  WEB_PDF_COVER_SERVICE_TOKEN,
} from '@sheldrapps/file-kit/pdf';

import { FileService } from './file.service';
import { PdfRewriteService } from './pdf-rewrite.service';

describe('FileService', () => {
  let service: FileService;
  let webPdfCover: jasmine.SpyObj<WebPdfCoverService>;

  beforeEach(() => {
    webPdfCover = jasmine.createSpyObj<WebPdfCoverService>(
      'WebPdfCoverService',
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

  it('saveGeneratedPdf should persist internally on web and not trigger download', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const coverFile = new File([new Uint8Array([7, 8, 9])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo('book.pdf');
    const writpdflicPdfSpy = spyOn<any>(service, 'writpdflicPdf').and.resolveTo();
    const getUriSpy = spyOn<any>(service, 'getPublicPdfFileUriOrThrow').and.resolveTo(
      'app://library/book.pdf',
    );
    const persistAssetsSpy = spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'pdfcovermakerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });
    const cacheMetadataSpy = spyOn<any>(service, 'cacheResolvedCoverMetadata');

    const result = await service.saveGeneratedPdf({
      bytes,
      filename: 'book.pdf',
      coverFileForThumb: coverFile,
    });

    expect(writpdflicPdfSpy).toHaveBeenCalledWith('book.pdf', bytes);
    expect(getUriSpy).toHaveBeenCalledWith('book.pdf');
    expect(persistAssetsSpy).toHaveBeenCalledWith(coverFile, 'book.pdf');
    expect(cacheMetadataSpy).toHaveBeenCalledWith('book.pdf', undefined);
    expect(webPdfCover.triggerDownload).not.toHaveBeenCalled();
    expect(result).toEqual({
      path: 'pdfcovermaker/book.pdf',
      uri: 'app://library/book.pdf',
      filename: 'book.pdf',
      thumbPath: 'pdfcovermakerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });
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
});
